"use strict";

// Browser-only prototype. Never store or send real patient information.
(() => {
    const patientForm = document.getElementById("patientForm");
    const triageForm = document.getElementById("triageForm");
    const table = document.getElementById("patientTable");
    const count = document.getElementById("patientCount");
    const clearButton = document.getElementById("clearDemoEntries");

    if (!patientForm || !triageForm || !table || !count || !clearButton) {
        return;
    }

    let demoPatientCount = 0;
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.style.marginTop = "12px";
    patientForm.insertAdjacentElement("afterend", status);

    patientForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const name = document.getElementById("patientName").value.trim();
        const ageText = document.getElementById("patientAge").value.trim();
        const age = Number(ageText);
        const gender = document.getElementById("patientGender").value;
        const phone = document.getElementById("patientPhone").value.trim();

        if (!name || !ageText || !Number.isInteger(age) || age < 0 || age > 120) {
            status.textContent = "Enter a fictional name and an age from 0 to 120.";
            return;
        }

        // Use textContent rather than HTML injection for user-entered text.
        const row = document.createElement("tr");
        for (const value of [name, String(age), gender || "—", phone || "—"]) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        }

        document.getElementById("emptyRow")?.remove();
        table.appendChild(row);
        demoPatientCount += 1;
        count.textContent = String(demoPatientCount);
        clearButton.disabled = false;
        status.textContent = "Sample entry added in this tab only. Nothing was saved or sent.";
        patientForm.reset();
    });

    clearButton.addEventListener("click", () => {
        if (demoPatientCount === 0) return;

        // Remove only temporary DOM entries. No patient data is persisted.
        table.replaceChildren();
        const emptyRow = document.createElement("tr");
        emptyRow.id = "emptyRow";
        const emptyCell = document.createElement("td");
        emptyCell.colSpan = 4;
        emptyCell.className = "empty-state";
        emptyCell.textContent = "No fictional sample entries yet.";
        emptyRow.appendChild(emptyCell);
        table.appendChild(emptyRow);

        demoPatientCount = 0;
        count.textContent = "0";
        clearButton.disabled = true;
        status.textContent = "All fictional sample entries were cleared from this tab.";
    });

    // No validated clinical logic exists. Do not generate fictitious risk scores.
    const triageNotice = document.createElement("p");
    triageNotice.setAttribute("role", "status");
    triageNotice.textContent =
        "Triage scoring is not implemented. Do not enter real health information or use this prototype for medical decisions.";
    triageForm.replaceWith(triageNotice);
    document.getElementById("triageResult")?.classList.add("hidden");
    document.getElementById("totalAssessments").textContent = "N/A";
    document.getElementById("latestRisk").textContent = "N/A";

    document.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".nav-link").forEach((item) => {
                item.classList.remove("active");
            });
            link.classList.add("active");
        });
    });
})();
