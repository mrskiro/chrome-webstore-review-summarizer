# chrome-webstore-review-summarizer

> [!WARNING]
> All responsibility for the use of this script rests with the user.

This script performs a comprehensive analysis of browser extension reviews. It extracts and processes reviews from a given URL, generates structured reports in JSON, Markdown, and CSV formats, and optionally utilizes OpenAI's API to provide a detailed analysis. The main objectives are to analyze user sentiment, identify feature requests, and uncover recurring issues and user demographics.

## Features

- Extract Reviews: Collects user reviews from a specified URL.
- Generate Reports: Produces JSON, Markdown, and CSV files with review data.
- OpenAI Integration: Optionally uploads review data to OpenAI and generates a detailed report based on provided prompts.

## Prerequisites

- `pnpm`
- `node ^22.8.0`

## Install

```bash
pnpm install
```

## Usage

```bash
# With OpenAI Integration
pnpm start -u https://chromewebstore.google.com/detail/your-extension-name/your-extention-id/reviews --apyKey your-openai-api-key

# Without OpenAI Integration
pnpm start -u https://chromewebstore.google.com/detail/your-extension-name/your-extention-id/reviews
```

### Arguments

- `--url, -u`: The URL of the page containing the reviews (required).
- `--apiKey`: Your OpenAI API key (optional).

### Output

- JSON: `report/reviews.json`
- Markdown: `report/reviews.md`
- CSV: `report/reviews.csv`
- Markdown Report (optional): `report/report.md` - Detailed analysis report from OpenAI, if API key is provided.
