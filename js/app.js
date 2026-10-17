import {
    loadJsonData,
    renderQuestion,
    renderQuestionNavigation,
    validateQuestionData,
    validateTechnologies
} from "./questions.js";

const appRoot = document.getElementById("appRoot");
const $ = id => document.getElementById(id);
let questionData = null;
let currentIndex = 0;
let currentUtterance = null;
let readAllActive = false;
let sequenceToken = 0;
let toastTimer;

function showError(element, message) {
    element.textContent = message;
    element.classList.remove("hidden");
}

function setTheme() {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    $("themeToggle").setAttribute("aria-pressed", String(dark));
    $("themeToggle").title = dark ? "Switch to light theme" : "Switch to dark theme";
    $("themeToggle").setAttribute("aria-label", $("themeToggle").title);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#101114" : "#f5f6f8");
}

function renderTechnologyCards(technologies, questionCounts, filter = "") {
    const grid = $("techGrid");
    const term = filter.trim().toLocaleLowerCase();
    const filtered = technologies.filter(technology =>
        `${technology.name} ${technology.description}`.toLocaleLowerCase().includes(term)
    );
    grid.replaceChildren();

    if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "empty col-12";
        empty.textContent = "No technology matches your search.";
        grid.append(empty);
        return;
    }

    filtered.forEach(technology => {
        const card = document.createElement("a");
        card.className = "tech-card col";
        card.href = technology.pageUrl;
        card.setAttribute("aria-label", `Open ${technology.name} questions`);

        const icon = document.createElement("span");
        icon.className = "tech-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = technology.icon;

        const name = document.createElement("strong");
        name.textContent = technology.name;

        const description = document.createElement("small");
        description.textContent = technology.description;

        const bottom = document.createElement("span");
        bottom.className = "card-bottom";
        const count = questionCounts[technology.id];
        const countLabel = document.createElement("span");
        countLabel.textContent = count === null
            ? "Question data unavailable"
            : count > 0
                ? `${count} questions`
                : "Coming soon";
        const arrow = document.createElement("span");
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "↗";
        bottom.append(countLabel, arrow);

        card.append(icon, name, description, bottom);
        grid.append(card);
    });
}

async function initDashboard() {
    const status = $("technologyStatus");
    const grid = $("techGrid");
    try {
        const technologies = validateTechnologies(await loadJsonData("data/technologies.json"));
        const questionCounts = Object.fromEntries(await Promise.all(technologies.map(async technology => {
            try {
                const data = validateQuestionData(await loadJsonData(`data/${technology.id}.json`));
                return [technology.id, data.questions.length];
            } catch (error) {
                console.error(`Unable to load question count for ${technology.id}.`, error);
                return [technology.id, null];
            }
        })));
        status.classList.add("hidden");
        renderTechnologyCards(technologies, questionCounts);
        $("techSearch").addEventListener("input", event =>
            renderTechnologyCards(technologies, questionCounts, event.target.value)
        );
    } catch (error) {
        console.error("Unable to load technology metadata.", error);
        status.classList.add("hidden");
        showError(status, "Technologies could not be loaded. Check your connection and refresh the page.");
        grid.setAttribute("aria-busy", "false");
    }
}

function showQuestion(index) {
    const questions = questionData.questions;
    if (!questions.length || index < 0 || index >= questions.length) return;
    currentIndex = index;
    const question = questions[currentIndex];
    renderQuestion(question, currentIndex, questions.length);
    renderQuestionNavigation(questions, currentIndex, selectedIndex => {
        stopSpeech();
        showQuestion(selectedIndex);
    });
}

function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.style.display = "none";
    }, 2200);
}

function selectedLanguage() {
    return $("speechLanguage").value;
}

function getVoice(language) {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    const prefix = language.toLowerCase().split("-")[0];
    return voices.find(voice => voice.lang.toLowerCase() === language.toLowerCase())
        || voices.find(voice => voice.lang.toLowerCase().startsWith(`${prefix}-`))
        || null;
}

function setSpeechStatus(message) {
    $("speechStatus").textContent = message;
}

function speakText(text, language, onEnd) {
    if (!("speechSynthesis" in window)) {
        setSpeechStatus("Speech synthesis is not supported in this browser. Try the latest Chrome or Edge.");
        return false;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = Number($("speechRate").value);
    const voice = getVoice(language);
    if (voice) utterance.voice = voice;
    currentUtterance = utterance;
    utterance.onstart = () => setSpeechStatus(
        `Speaking · ${language === "mr-IN" ? "Marathi (India)" : "English (India)"}${voice ? ` · ${voice.name}` : " · browser default voice"}`
    );
    utterance.onerror = event => {
        if (event.error !== "canceled" && event.error !== "interrupted") {
            setSpeechStatus("Speech could not start. Check your browser voice settings.");
        }
    };
    utterance.onend = () => {
        if (currentUtterance === utterance) currentUtterance = null;
        if (onEnd) onEnd();
        else if (!readAllActive) setSpeechStatus("Finished reading.");
    };
    window.speechSynthesis.speak(utterance);
    return true;
}

function readCurrent(language = selectedLanguage()) {
    const question = questionData?.questions[currentIndex];
    if (!question) return;
    readAllActive = false;
    sequenceToken++;
    const prompt = language === "mr-IN" && question.questionMarathi
        ? question.questionMarathi
        : question.question;
    const answer = language === "mr-IN" ? question.answerMarathi : question.answer;
    speakText(`${prompt}. ${answer}`, language);
}

function readAll() {
    if (!("speechSynthesis" in window)) {
        setSpeechStatus("Speech synthesis is not supported in this browser. Try the latest Chrome or Edge.");
        return;
    }
    const questions = questionData?.questions || [];
    if (!questions.length) return;

    const language = selectedLanguage();
    readAllActive = true;
    const token = ++sequenceToken;
    window.speechSynthesis.cancel();
    let index = 0;
    const next = () => {
        if (token !== sequenceToken || !readAllActive) return;
        if (index >= questions.length) {
            readAllActive = false;
            currentUtterance = null;
            setSpeechStatus("All questions completed. Great work!");
            return;
        }
        showQuestion(index);
        const question = questions[index++];
        const prompt = language === "mr-IN" && question.questionMarathi
            ? question.questionMarathi
            : question.question;
        const answer = language === "mr-IN" ? question.answerMarathi : question.answer;
        speakText(`${prompt}. ${answer}`, language, () => {
            if (token === sequenceToken && readAllActive) next();
        });
    };
    next();
}

function stopSpeech() {
    sequenceToken++;
    readAllActive = false;
    currentUtterance = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function initQuestionControls() {
    $("prevBtn").addEventListener("click", () => {
        if (currentIndex > 0) {
            stopSpeech();
            showQuestion(currentIndex - 1);
        }
    });
    $("nextBtn").addEventListener("click", () => {
        if (currentIndex < questionData.questions.length - 1) {
            stopSpeech();
            showQuestion(currentIndex + 1);
        }
    });
    $("readCurrent").addEventListener("click", () => readCurrent());
    $("readAll").addEventListener("click", readAll);
    $("speakEnglish").addEventListener("click", () => readCurrent("en-IN"));
    $("speakMarathi").addEventListener("click", () => readCurrent("mr-IN"));
    $("pauseBtn").addEventListener("click", () => {
        if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            setSpeechStatus("Speech paused.");
        }
    });
    $("resumeBtn").addEventListener("click", () => {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.resume();
            setSpeechStatus("Speech resumed.");
        }
    });
    $("stopBtn").addEventListener("click", () => {
        stopSpeech();
        setSpeechStatus("Speech stopped.");
    });
    $("copyCode").addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText($("codeExample").textContent);
            showToast("Code copied");
        } catch (error) {
            console.error("Unable to copy the code example.", error);
            showToast("Clipboard access is unavailable in this preview.");
        }
    });
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
}

async function initQuestionPage(technologyId) {
    const loading = $("loadingState");
    const error = $("errorState");
    const empty = $("emptyState");
    try {
        questionData = validateQuestionData(await loadJsonData(`data/${technologyId}.json`));
        document.title = `${questionData.technology} Interview Questions · Interview Prep Studio`;
        $("practiceTitle").textContent = `${questionData.technology} Interview Questions`;
        loading.classList.add("hidden");
        if (!questionData.questions.length) {
            empty.classList.remove("hidden");
            return;
        }
        $("practiceContent").classList.remove("hidden");
        initQuestionControls();
        showQuestion(0);
    } catch (loadError) {
        console.error(`Unable to load ${technologyId} question data.`, loadError);
        loading.classList.add("hidden");
        showError(error, "Questions could not be loaded. Check your connection and refresh the page.");
    }
}

$("themeToggle").addEventListener("click", setTheme);
if (appRoot.dataset.page === "dashboard") {
    initDashboard();
} else if (appRoot.dataset.page === "questions") {
    initQuestionPage(appRoot.dataset.technology);
}
