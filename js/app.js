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
        empty.className = "empty";
        empty.style.gridColumn = "1 / -1";
        empty.textContent = "No technology matches your search.";
        grid.append(empty);
        return;
    }

    filtered.forEach(technology => {
        const card = document.createElement("a");
        card.className = "tech-card";
        card.href = technology.pageUrl;
        card.style.setProperty("--tech-accent", technology.accentColor || "var(--text)");
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
                const data = validateQuestionData(await loadJsonData(technology.dataUrl));
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

function showQuestion(index, { updateHash = true, focusQuestion = false } = {}) {
    const questions = questionData.questions;
    if (!questions.length || index < 0 || index >= questions.length) return;
    currentIndex = index;
    const question = questions[currentIndex];
    renderQuestion(question, currentIndex, questions.length);
    if (updateHash) {
        history.replaceState(null, "", `#question-${encodeURIComponent(question.id)}`);
    }
    if (focusQuestion) {
        const title = $("questionTitle");
        title.focus({ preventScroll: true });
        title.classList.remove("search-highlight");
        title.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
        requestAnimationFrame(() => title.classList.add("search-highlight"));
    }
    renderQuestionNavigation(questions, currentIndex, selectedIndex => {
        stopSpeech();
        showQuestion(selectedIndex);
    });
}

function normalizeSearch(value) {
    return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function indexFromLocationHash(questions) {
    const questionId = decodeURIComponent(location.hash.slice(1)).replace(/^question-/, "");
    return questions.findIndex(question => String(question.id) === questionId);
}

function initQuestionSearch(questions) {
    const practiceBody = document.querySelector(".practice-body");
    const search = document.createElement("section");
    search.className = "question-search";
    search.setAttribute("aria-label", "Search interview questions");

    const label = document.createElement("label");
    label.className = "question-search-label";
    label.htmlFor = "questionSearch";
    label.textContent = "Find a question";

    const controls = document.createElement("div");
    controls.className = "question-search-controls";
    const input = document.createElement("input");
    input.className = "search question-search-input";
    input.id = "questionSearch";
    input.type = "search";
    input.placeholder = "Search English, Marathi, number, category or keyword";
    input.autocomplete = "off";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", "questionSearchResults");

    const clear = document.createElement("button");
    clear.className = "btn question-search-clear hidden";
    clear.type = "button";
    clear.textContent = "Clear";
    clear.setAttribute("aria-label", "Clear question search");

    controls.append(input, clear);
    const status = document.createElement("div");
    status.className = "question-search-status";
    status.id = "questionSearchStatus";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const results = document.createElement("div");
    results.className = "question-search-results hidden";
    results.id = "questionSearchResults";
    results.setAttribute("role", "listbox");
    results.setAttribute("aria-label", "Matching questions");

    const noResults = document.createElement("p");
    noResults.className = "question-search-empty hidden";
    noResults.setAttribute("role", "status");
    noResults.textContent = "Try another keyword, question number, or Marathi search.";

    search.append(label, controls, status, results, noResults);
    practiceBody.insertBefore(search, $("practiceContent"));

    const searchable = questions.map((question, index) => ({
        question,
        index,
        text: normalizeSearch([
            `question ${index + 1}`,
            question.id,
            question.question,
            question.questionMarathi,
            question.category,
            question.topicTitle,
            question.title,
            ...(question.tags || []),
            ...(question.keywords || []),
            ...(question.keyPoints || []).filter(value => typeof value === "string")
        ].filter(Boolean).join(" "))
    }));

    const closeResults = () => {
        results.classList.add("hidden");
        input.setAttribute("aria-expanded", "false");
    };

    const selectResult = index => {
        stopSpeech();
        input.value = "";
        clear.classList.add("hidden");
        status.textContent = "";
        closeResults();
        showQuestion(index, { focusQuestion: true });
    };

    const renderResults = () => {
        const term = normalizeSearch(input.value);
        clear.classList.toggle("hidden", !term);
        results.replaceChildren();
        if (!term) {
            status.textContent = "";
            closeResults();
            return;
        }

        const matches = searchable.filter(item => item.text.includes(term));
        status.textContent = matches.length
            ? `${matches.length} matching ${matches.length === 1 ? "question" : "questions"}`
            : "No questions match your search.";
        input.setAttribute("aria-expanded", String(matches.length > 0));
        results.classList.toggle("hidden", matches.length === 0);
        noResults.classList.toggle("hidden", matches.length > 0);

        matches.forEach(({ question, index }) => {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "question-search-result";
            option.setAttribute("role", "option");
            option.setAttribute("aria-label", `Question ${index + 1}: ${question.question}`);
            const number = document.createElement("span");
            number.className = "question-search-number";
            number.textContent = String(index + 1);
            const title = document.createElement("span");
            title.className = "question-search-result-title";
            title.textContent = question.question;
            const marathi = document.createElement("small");
            marathi.lang = "mr";
            marathi.textContent = question.questionMarathi || "";
            option.append(number, title, marathi);
            option.addEventListener("click", () => selectResult(index));
            results.append(option);
        });

    };

    input.addEventListener("input", renderResults);
    input.addEventListener("keydown", event => {
        if (event.key === "ArrowDown" && !results.classList.contains("hidden")) {
            const first = results.querySelector(".question-search-result");
            if (first) {
                event.preventDefault();
                first.focus();
            }
        } else if (event.key === "Escape") {
            input.value = "";
            renderResults();
        } else if (event.key === "Enter") {
            const first = results.querySelector(".question-search-result");
            if (first) {
                event.preventDefault();
                first.click();
            }
        }
    });
    results.addEventListener("keydown", event => {
        const options = [...results.querySelectorAll(".question-search-result")];
        const activeIndex = options.indexOf(document.activeElement);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const direction = event.key === "ArrowDown" ? 1 : -1;
            options[(activeIndex + direction + options.length) % options.length]?.focus();
        } else if (event.key === "Escape") {
            closeResults();
            input.focus();
        }
    });
    clear.addEventListener("click", () => {
        input.value = "";
        input.focus();
        renderResults();
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
        showQuestion(index, { updateHash: false });
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
        const technologies = validateTechnologies(await loadJsonData("data/technologies.json"));
        const technology = technologyId
            ? technologies.find(entry => entry.id === technologyId)
            : technologies.find(entry => new URL(entry.pageUrl, location.href).pathname === location.pathname);
        if (!technology) {
            throw new Error(technologyId ? `Unknown technology "${technologyId}".` : "No technology was selected.");
        }
        questionData = validateQuestionData(await loadJsonData(technology.dataUrl));
        const questionTitle = `${questionData.technology} Interview Questions`;
        document.title = `${questionTitle} · Interview Prep Studio`;
        $("practiceTitle").textContent = questionTitle;
        loading.classList.add("hidden");
        if (!questionData.questions.length) {
            empty.classList.remove("hidden");
            return;
        }
        $("practiceContent").classList.remove("hidden");
        $("questionTitle").tabIndex = -1;
        initQuestionSearch(questionData.questions);
        initQuestionControls();
        const initialIndex = indexFromLocationHash(questionData.questions);
        showQuestion(initialIndex >= 0 ? initialIndex : 0, { updateHash: initialIndex < 0 });
        window.addEventListener("hashchange", () => {
            const hashIndex = indexFromLocationHash(questionData.questions);
            if (hashIndex >= 0 && hashIndex !== currentIndex) {
                stopSpeech();
                showQuestion(hashIndex, { updateHash: false, focusQuestion: true });
            }
        });
    } catch (loadError) {
        console.error(`Unable to load ${technologyId} question data.`, loadError);
        loading.classList.add("hidden");
        if (loadError.message.startsWith("Unknown technology") || loadError.message === "No technology was selected.") {
            showError(error, "This technology could not be found. Return to the dashboard and choose a technology.");
        } else {
            showError(error, "Questions could not be loaded. Check your connection or the technology JSON, then refresh.");
        }
    }
}

function initPwa() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" })
            .catch(error => console.error("Unable to register the offline application worker.", error));
    }

    let installEvent;
    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        installEvent = event;
        const actions = document.querySelector(".top-actions");
        if (!actions || $("installApp")) return;
        const button = document.createElement("button");
        button.className = "icon-btn install-btn";
        button.id = "installApp";
        button.type = "button";
        const label = document.createElement("span");
        label.className = "install-label";
        label.textContent = "Install";
        button.append(label);
        button.setAttribute("aria-label", "Install Interview Prep Studio");
        button.addEventListener("click", async () => {
            if (!installEvent) return;
            try {
                await installEvent.prompt();
                await installEvent.userChoice;
            } catch (error) {
                console.error("The application install prompt could not be completed.", error);
            } finally {
                installEvent = null;
                button.remove();
            }
        });
        actions.prepend(button);
    });
    window.addEventListener("appinstalled", () => {
        installEvent = null;
        $("installApp")?.remove();
    });
    window.addEventListener("offline", () =>
        showToast("You are offline. Cached pages and questions remain available.")
    );
    window.addEventListener("online", () => showToast("You are back online."));
}

$("themeToggle").addEventListener("click", setTheme);
if (appRoot.dataset.page === "dashboard") {
    initDashboard();
} else if (appRoot.dataset.page === "questions") {
    initQuestionPage(new URLSearchParams(location.search).get("technology"));
}
initPwa();
