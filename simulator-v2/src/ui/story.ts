let storyTimeouts: ReturnType<typeof setTimeout>[] = [];
let storyCrawlTimer: ReturnType<typeof setInterval> | null = null;
let storyFinished = false;

export function initStoryExperience(onComplete: () => void) {
    const storyScreen = document.getElementById("storyIntro");
    const storyButton = document.getElementById("storyStartBtn");
    const storySkipButton = document.getElementById("storySkipBtn");
    const storyScroll = document.getElementById("storyScroll");
    const storyLines = [...document.querySelectorAll(".story-line")] as HTMLElement[];
    const storyContainer = document.querySelector(".story-intro-container") as HTMLElement | null;

    if (!storyScreen || !storyButton || storyLines.length === 0) {
        onComplete();
        return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
        storyLines.forEach(line => line.classList.add("visible"));
        storyButton.classList.add("ready");
        storyButton.addEventListener("click", () => finish());
        storySkipButton?.addEventListener("click", () => finish());
        return;
    }

    if (storyScroll) {
        storyScroll.classList.add("crawl-active");
    }

    storyLines.forEach(line => {
        line.dataset.fullText = line.textContent?.trim() || "";
        line.textContent = "";
    });

    if (storyContainer) {
        storyCrawlTimer = setInterval(() => {
            if (!storyFinished) {
                storyContainer.scrollTop += 0.5;
            }
        }, 16);
    }

    let timelineDelay = 700;
    storyLines.forEach(line => {
        const fullText = line.dataset.fullText || "";
        storyTimeouts.push(
            setTimeout(() => {
                storyLines.forEach(sl => sl.classList.remove("current-line"));
                line.classList.add("visible");
                line.classList.add("current-line");
                typeStoryLine(line, fullText);
                scrollStoryFromMiddle(line, storyContainer);
            }, timelineDelay)
        );

        const linePause = Number(line.dataset.pause || 1800);
        timelineDelay += linePause + Math.min(fullText.length * 16, 1300);
    });

    storyTimeouts.push(
        setTimeout(() => {
            storyButton.classList.add("ready");
        }, timelineDelay)
    );

    storyButton.addEventListener("click", () => finish());
    storySkipButton?.addEventListener("click", () => finish());
    storyScreen.addEventListener("dblclick", () => finish());

    function finish() {
        storyFinished = true;
        storyTimeouts.forEach(clearTimeout);
        storyTimeouts = [];
        if (storyCrawlTimer) clearInterval(storyCrawlTimer);
        onComplete();
    }
}

function typeStoryLine(el: HTMLElement, text: string) {
    el.textContent = "";
    let i = 0;
    const interval = setInterval(() => {
        if (i < text.length) {
            el.textContent += text[i];
            i++;
        } else {
            clearInterval(interval);
        }
    }, 14);
}

function scrollStoryFromMiddle(line: HTMLElement, container: HTMLElement | null) {
    if (!container) return;
    const lineRect = line.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const targetScroll = container.scrollTop + lineRect.top - containerRect.top - containerRect.height / 2;
    container.scrollTo({ top: targetScroll, behavior: "smooth" });
}
