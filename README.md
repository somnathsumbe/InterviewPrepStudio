# Interview Prep Studio

A lightweight, vanilla JavaScript interview-practice PWA. Serve this folder over HTTP; service workers and Fetch are not available when pages are opened with `file://`.

## Run locally

From the project directory, run `python -m http.server 8000` and open `http://localhost:8000/`.

## Add or edit a technology

1. Add a question file under `data/`, using the technology ID as its filename.
2. Add one entry to `data/technologies.json` with `id`, `name`, `description`, `icon`, `pageUrl`, `dataUrl`, and an optional hex `accentColor`. For a technology without a dedicated HTML page, set `pageUrl` to `technology.html?technology=<id>`.
3. Keep question IDs unique within that technology. Existing practice pages and the shared page read the configured `dataUrl`; question content does not belong in HTML or JavaScript.

### Question JSON

Each data file has a `technology` name and a `questions` array. Every question must have a unique integer `id`, English and Marathi `question` and `answer` strings. `category`, `tags`, `keywords`, `topicTitle`, and `keyPoints` are optional search metadata. `codeExample`, `codeExplanation`, and `codeExplanationMarathi` are optional strings and may be empty.

Example:

```json
{
  "technology": "Example",
  "questions": [
    {
      "id": 1,
      "category": "BASICS",
      "tags": ["intro"],
      "question": "What is this?",
      "questionMarathi": "हे काय आहे?",
      "answer": "An example answer.",
      "answerMarathi": "उदाहरण उत्तर.",
      "codeExample": "",
      "codeExplanation": "",
      "codeExplanationMarathi": ""
    }
  ]
}
```

## PWA and offline behavior

`manifest.webmanifest` defines installation metadata and local icons. `sw.js` precaches the app shell, technology pages, and question JSON; navigations and JSON use network-first with cached offline fallbacks, and local static assets use cache-first. When changing service-worker behavior or its precache strategy, increment `CACHE_NAME` in `sw.js`. The browser activates updated workers and removes older app caches.

Install prompts are browser-controlled and only appear on supported browsers when their install criteria are met. Offline use is available after the app has first been opened online and its resources have been cached.
