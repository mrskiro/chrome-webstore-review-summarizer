import { chromium } from "@playwright/test";
import OpenAI from "openai";
import { parseArgs } from "node:util";
import { exit } from "node:process";
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";

const JSON_FILE_PATH = "report/reviews.json";

const prompt = `**Goal:**  
Analyze browser extension reviews to assess user sentiment, identify common feature requests, pinpoint recurring issues, and derive insights about user demographics and usage patterns. The aim is to gain actionable feedback and understand how the extension is being used.

---

**Improved Prompt:**
You are provided with a dataset of browser extension reviews. Conduct a detailed analysis focusing on the following aspects, with an emphasis on overall trends and key findings:

1. **Sentiment Analysis:**  
   - Categorize each review into positive, neutral, or negative sentiment.  
   - Summarize the sentiment distribution (e.g., percentage of positive, neutral, negative reviews).  
   - Provide a high-level summary of common themes for each sentiment category. Identify what users tend to appreciate, criticize, or feel indifferent about. Highlight major points for each sentiment group.

2. **Feature Requests:**  
   - Extract specific feature requests mentioned in the reviews.  
   - Identify frequently requested features and note any patterns or trends in user expectations. For example, are users seeking enhanced customization, better performance, or new functionalities?

3. **Issues and Problems:**  
   - Identify recurring problems or complaints expressed by users.  
   - Group these issues based on frequency or impact (e.g., high-severity bugs, minor annoyances).  
   - Highlight critical concerns that multiple users raise or those that seem to be hindering user satisfaction.

4. **User Demographics and Usage Patterns:**  
   - Analyze the content of reviews to infer user demographics such as industry, profession, or common use cases. For example, do students, professionals, or researchers frequently mention using the extension for specific tasks?  
   - Summarize any patterns related to how and why users are employing the extension (e.g., for work efficiency, study, or specific tasks).

5. **Overall Insights:**  
   - Provide a concise overview of key takeaways from the analysis, summarizing user sentiment, feature requests, recurring issues, and usage patterns. This summary should inform future development decisions.

---

### Example Output Structure:

1. **Sentiment Analysis:**  
   - Positive sentiment (e.g., fast performance, user-friendly interface)  
   - Neutral sentiment (e.g., mixed feelings about the UI design)  
   - Negative sentiment (e.g., frequent crashes, privacy concerns)  
   - Sentiment Distribution: 70% positive, 20% neutral, 10% negative

2. **Feature Requests:**  
   - Common feature requests: Offline mode, dark theme, enhanced integration with other tools  
   - Emerging trends: Customization features, privacy enhancements

3. **Issues and Problems:**  
   - Recurring issues: Slow loading time, frequent crashes after updates  
   - Severity: Critical issues (affecting many users), minor inconveniences (raised by a few)

4. **User Demographics and Usage Patterns:**  
   - Professions or industries: Students, researchers, IT professionals  
   - Common use cases: Speeding up workflow, organizing tasks for research

5. **Overall Insights:**  
   - Most users appreciate the extension's speed and usability. However, stability issues and the lack of certain customization options are major pain points. Feature requests like an offline mode and better privacy controls are commonly mentioned, and the extension is particularly popular among students and professionals using it to enhance their workflow."

---`;

(async () => {
  const { url, apiKey } = parseArgs({
    options: {
      url: {
        type: "string",
        short: "u",
      },
      apiKey: {
        type: "string",
      },
    },
  }).values;

  if (!url) {
    console.error("Error: --url(-u) is required");
    exit(1);
  }
  if (!URL.canParse(url)) {
    console.error("Error: --url(-u) is invalid");
    exit(1);
  }

  const b = await chromium.launch({ headless: false });
  const ctx = await b.newContext({
    locale: "en-US",
  });
  const p = await ctx.newPage();

  await p.goto(url);

  while (true) {
    console.count("Load more");
    const btn = p.getByRole("button", { name: "Load more" });

    try {
      await btn.click();
    } catch (error) {
      const count = await btn.count();
      if (count === 0) {
        break;
      }
    }
  }

  const reviews = await p.locator("div > section").all();

  const data = [];
  for (const review of reviews) {
    try {
      const name = await review.locator("h3 > span").first().innerText();
      const content = await review.locator("p").first().innerText();
      const rate = await review
        .locator("h3 > div")
        .evaluate((el) => el.ariaLabel)
        .then((v) => v?.at(0));
      const createdAt = await review.locator("h3 > span").last().innerText();
      data.push({
        name,
        content,
        rate,
        createdAt: formatDate(createdAt),
      });
    } catch (error) {
      console.error(error);
    }
  }

  await writeFile(JSON_FILE_PATH, JSON.stringify(data, null, 2));
  console.log("JSON generated");

  await writeFile(
    "report/reviews.md",
    data
      .map(
        (d) =>
          `Name:${d.name}\nRate: ${d.rate}\nDate: ${d.createdAt}\nContent:${d.content}`
      )
      .join("\n\n")
  );
  console.log("Markdown generated");

  await writeFile(
    "report/reviews.csv",
    [
      "Name,Rate,Date,Content",
      ...data.map((v) => {
        const content = `"${v.content.replace(/"/g, '""')}"`;
        return `${v.name},${v.rate},${v.createdAt},${content}`;
      }),
    ].join("\n"),
    "utf8"
  );
  console.log("CSV generated");

  if (apiKey) {
    console.log("OpenAI processing...");
    const client = new OpenAI({
      apiKey,
    });
    const fileObject = await client.files.create({
      file: createReadStream(JSON_FILE_PATH),
      purpose: "assistants",
    });
    console.log("File uploaded");

    const assistant = await client.beta.assistants.create({
      name: "Review summarizer",
      instructions: prompt,
      model: "gpt-4o",
      tools: [{ type: "file_search" }],
    });
    console.log("Assistant created");

    const thread = await client.beta.threads.create({
      messages: [
        {
          role: "user",
          content: "Please analyze reviews.",
          attachments: [
            { file_id: fileObject.id, tools: [{ type: "file_search" }] },
          ],
        },
      ],
    });
    console.log("Thread created");

    console.log("Runnning...");
    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id,
    });
    console.log("Done.");

    const messages = await client.beta.threads.messages.list(thread.id, {
      run_id: run.id,
    });

    const content = messages.data.at(-1)?.content[0];
    if (content?.type === "text") {
      await writeFile("report/report.md", content.text.value);
      console.log("Report generated");
    }
    await client.beta.assistants.del(assistant.id);
  }

  console.log(`Done. reviews: ${data.length}`);
  exit(0);
})();

/**
 * "Sep 7, 2024" → "2024/09/07"
 */
function formatDate(dateStr: string): string {
  const dtf = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const d = new Date(dateStr);
  return dtf.format(d);
}
