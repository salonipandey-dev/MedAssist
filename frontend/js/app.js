"use strict";

// Browser-only prototype. Never store or send real patient information.
(() => {
    const patientForm = document.getElementById("patientForm");
    const table = document.getElementById("patientTable");
    const count = document.getElementById("patientCount");

    if (!patientForm || !table || !count) {
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
        status.textContent = "Sample entry added in this tab only. Nothing was saved or sent.";
        patientForm.reset();
    });

    // Triage is intentionally not implemented; its unavailable notice is static HTML.

    document.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".nav-link").forEach((item) => {
                item.classList.remove("active");
            });
            link.classList.add("active");
        });
    });
})();
