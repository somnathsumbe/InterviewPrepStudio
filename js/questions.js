const questionFields = [
    "question",
    "questionMarathi",
    "answer",
    "answerMarathi",
    "codeExample",
    "codeExplanation",
    "codeExplanationMarathi"
];

export async function loadJsonData(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    return response.json();
}

export function validateTechnologies(data) {
    if (!Array.isArray(data)) {
        throw new Error("Technology data must be a JSON array.");
    }

    const ids = new Set();
    data.forEach((technology, index) => {
        if (!technology || typeof technology !== "object") {
            throw new Error(`Technology entry ${index + 1} is invalid.`);
        }
        const { id, name, description, icon, pageUrl } = technology;
        if (![id, name, description, icon, pageUrl].every(value => typeof value === "string" && value.trim())) {
            throw new Error(`Technology entry ${index + 1} is missing required metadata.`);
        }
        if (!/^[a-z0-9-]+$/.test(id) || ids.has(id)) {
            throw new Error(`Technology ID "${id}" is invalid or duplicated.`);
        }
        ids.add(id);
    });
    return data;
}

export function validateQuestionData(data) {
    if (!data || typeof data.technology !== "string" || !Array.isArray(data.questions)) {
        throw new Error("Question data must include a technology name and questions array.");
    }

    const ids = new Set();
    data.questions.forEach((question, index) => {
        if (!question || typeof question !== "object" || !Number.isInteger(question.id) || ids.has(question.id)) {
            throw new Error(`Question entry ${index + 1} has an invalid or duplicated ID.`);
        }
        ids.add(question.id);
        for (const field of questionFields) {
            if (typeof question[field] !== "string") {
                throw new Error(`Question ${question.id} must have a string "${field}" value.`);
            }
        }
        if (!question.question.trim() || !question.answer.trim() || !question.answerMarathi.trim()) {
            throw new Error(`Question ${question.id} is missing a question or answer.`);
        }
        if (question.category !== undefined && typeof question.category !== "string") {
            throw new Error(`Question ${question.id} has an invalid category.`);
        }
    });
    return data;
}

export function renderQuestion(question, index, total) {
    document.getElementById("questionNumber").textContent = `QUESTION ${index + 1} OF ${total}`;
    document.getElementById("questionCategory").textContent = question.category || "QUESTION";
    document.getElementById("questionTitle").textContent = question.question;
    document.getElementById("englishAnswer").textContent = question.answer;
    document.getElementById("marathiAnswer").textContent = question.answerMarathi;

    const codeCard = document.getElementById("codeCard");
    codeCard.classList.toggle("hidden", !question.codeExample);
    document.getElementById("codeExample").textContent = question.codeExample;
    document.getElementById("englishCodeExplanation").textContent = question.codeExplanation;
    document.getElementById("marathiCodeExplanation").textContent = question.codeExplanationMarathi;
    document.getElementById("englishCodeExplanation").classList.toggle("hidden", !question.codeExplanation);
    document.getElementById("marathiCodeExplanation").classList.toggle("hidden", !question.codeExplanationMarathi);

    document.getElementById("progressFill").style.width = `${((index + 1) / total) * 100}%`;
    document.getElementById("prevBtn").disabled = index === 0;
    document.getElementById("nextBtn").disabled = index === total - 1;
}

export function renderQuestionNavigation(questions, activeIndex, onSelect) {
    const list = document.getElementById("questionDots");
    list.replaceChildren();
    questions.forEach((question, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `q-dot${index === activeIndex ? " active" : ""}`;
        button.textContent = String(index + 1);
        button.setAttribute("aria-label", `Go to question ${index + 1}`);
        if (index === activeIndex) button.setAttribute("aria-current", "step");
        button.addEventListener("click", () => onSelect(index));
        list.append(button);
    });
}
