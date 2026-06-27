(() => {
  const readings = window.READINGS || [];
  if (!readings.length) throw new Error("No published readings are available.");
  const dayNumber = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000);
  const reading = readings[dayNumber % readings.length];
  const storageKey = `roz-e-iqbal:${reading.id}`;
  const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");

  const $ = (id) => document.getElementById(id);
  const elements = {
    collection: $("collectionName"), title: $("readingTitle"), transliteration: $("readingTransliteration"),
    historicalNote: $("historicalNote"), historicalConfidence: $("historicalConfidence"),
    historicalContext: $("historicalContext"), historicalSource: $("historicalSource"),
    fullPoem: $("fullPoem"), poemLabel: $("fullPoemLabel"),
    favorite: $("favoriteButton"), note: $("reflectionNote"), status: $("savedStatus"),
    complete: $("completeButton"), completeText: $("completeText"), progress: $("progressValue"),
    progressBar: $("progressBar"), theme: $("themeButton")
  };

  function save(patch = {}) {
    Object.assign(saved, patch);
    localStorage.setItem(storageKey, JSON.stringify(saved));
  }

  function renderSavedState() {
    elements.favorite.classList.toggle("active", Boolean(saved.favorite));
    elements.favorite.textContent = saved.favorite ? "♥" : "♡";
    elements.favorite.setAttribute("aria-pressed", String(Boolean(saved.favorite)));
    elements.note.value = saved.note || "";
    elements.complete.classList.toggle("done", Boolean(saved.completed));
    elements.completeText.textContent = saved.completed ? "Today's reading completed" : "Complete today's reading";
    elements.progress.textContent = String((dayNumber % readings.length) + 1);
    elements.progressBar.style.width = `${((dayNumber % readings.length) + 1) / readings.length * 100}%`;
    document.body.classList.toggle("dark", saved.theme === "dark");
  }

  elements.collection.textContent = reading.collection;
  elements.title.textContent = reading.title;
  elements.transliteration.textContent = reading.transliteration;
  if (reading.historicalContext) {
    const context = reading.historicalContext;
    elements.historicalNote.hidden = false;
    elements.historicalConfidence.textContent = (context.confidence || "unknown").toUpperCase();
    elements.historicalContext.textContent = context.summaryEnglish || context.summaryUrdu || "";
    elements.historicalSource.textContent = [
      context.period && `Period: ${context.period}`,
      context.place && `Place: ${context.place}`,
      context.sourceNote
    ].filter(Boolean).join(" · ");
  }
  elements.poemLabel.textContent = `FULL POEM · ${reading.verses.length} COUPLETS`;
  elements.fullPoem.innerHTML = reading.verses.map((verse, index) => `
    <article class="poem-couplet">
      <span class="couplet-number">${index + 1}</span>
      <blockquote>${verse.urdu.join("\n")}</blockquote>
      <div class="couplet-guide">
        <p class="couplet-explanation">${verse.meaning}</p>
        <div class="inline-glosses" aria-label="مشکل الفاظ">
          ${verse.words.map(word => `<span class="inline-gloss"><b>${word.term}</b><i aria-hidden="true">—</i>${word.meaning}</span>`).join("")}
        </div>
      </div>
      ${verse.english ? `<p class="couplet-translation" dir="ltr" lang="en">${verse.english}</p>` : ""}
    </article>`).join("");
  $("reflectionQuestion").textContent = reading.reflection;
  $("takeawayText").textContent = reading.takeaway;
  $("todayLabel").textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();

  elements.favorite.addEventListener("click", () => { save({ favorite: !saved.favorite }); renderSavedState(); });
  elements.note.addEventListener("input", () => {
    save({ note: elements.note.value });
    elements.status.textContent = "Saved";
    clearTimeout(elements.note.saveTimer);
    elements.note.saveTimer = setTimeout(() => { elements.status.textContent = "Saved only on this device"; }, 1200);
  });
  elements.complete.addEventListener("click", () => { save({ completed: !saved.completed }); renderSavedState(); });
  elements.theme.addEventListener("click", () => { save({ theme: document.body.classList.contains("dark") ? "light" : "dark" }); renderSavedState(); });
  renderSavedState();
})();
