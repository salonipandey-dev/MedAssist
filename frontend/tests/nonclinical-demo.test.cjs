"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync(join(__dirname, "../index.html"), "utf8");
const javascript = readFileSync(join(__dirname, "../js/app.js"), "utf8");

test("triage cannot solicit health inputs if JavaScript is disabled", () => {
    const triage = html.match(/<section id="triage"\b[\s\S]*?<\/section>/i)?.[0];
    assert.ok(triage, "Triage section should remain available as an explanation");
    assert.match(triage, /id="triageAvailability"/);
    assert.match(triage, /not available/i);
    assert.doesNotMatch(triage, /<(?:input|textarea|select|form)\b/i);
    assert.doesNotMatch(html, /id="(?:riskLevel|riskScore|recommendedAction|triageResult)"/);
});

test("unimplemented risk and analytics metrics show N/A before JavaScript", () => {
    for (const id of [
        "lowRiskCount", "mediumRiskCount", "highRiskCount",
        "totalAssessments", "latestRisk",
    ]) {
        const tag = html.match(new RegExp('<(?:h2|h3) id="' + id + '">\\s*([^<]+)\\s*</(?:h2|h3)>'));
        assert.ok(tag, id + " should be present");
        assert.equal(tag[1].trim(), "N/A");
    }
    assert.match(html, /href="#patient" class="primary-btn"[\s\S]*?Try Sample Registration/);
    assert.doesNotMatch(html, /Start Triage|Analyse Patient/);
});

function makeElement() {
    return {
        value: "",
        textContent: "",
        children: [],
        listeners: {},
        style: {},
        classList: { add() {}, remove() {} },
        setAttribute() {},
        addEventListener(type, callback) { this.listeners[type] = callback; },
        insertAdjacentElement(_where, child) { this.notice = child; },
        appendChild(child) { child.parent = this; this.children.push(child); return child; },
        remove() {
            if (this.parent) {
                this.parent.children = this.parent.children.filter((child) => child !== this);
            }
        },
        reset() {},
    };
}

function loadDemoWithoutTriage() {
    const ids = [
        "patientForm", "patientTable", "patientCount",
        "patientName", "patientAge", "patientGender", "patientPhone",
    ];
    const elements = Object.fromEntries(ids.map((id) => [id, makeElement()]));
    elements.patientCount.textContent = "0";
    const emptyRow = makeElement();
    emptyRow.id = "emptyRow";
    elements.patientTable.appendChild(emptyRow);
    const document = {
        getElementById(id) {
            if (id === "emptyRow") {
                return elements.patientTable.children.find((row) => row.id === id) ?? null;
            }
            return elements[id] ?? null;
        },
        createElement: () => makeElement(),
        querySelectorAll: () => [],
    };
    vm.runInNewContext(javascript, {
        document,
        fetch() { throw new Error("The demo must not send data to a backend"); },
    });
    return {
        elements,
        submit(name, age) {
            elements.patientName.value = name;
            elements.patientAge.value = age;
            elements.patientGender.value = "Other";
            elements.patientPhone.value = "";
            elements.patientForm.listeners.submit({ preventDefault() {} });
        },
    };
}

test("registration works without a triage form and renders text safely", () => {
    assert.doesNotMatch(javascript, /\btriageForm\b/);
    const { elements, submit } = loadDemoWithoutTriage();
    submit("<img src=x onerror=alert(1)>", "25");
    assert.equal(elements.patientCount.textContent, "1");
    assert.equal(elements.patientTable.children.length, 1);
    assert.equal(
        elements.patientTable.children[0].children[0].textContent,
        "<img src=x onerror=alert(1)>",
    );
    assert.match(elements.patientForm.notice.textContent, /Nothing was saved or sent/);
});

test("invalid sample ages are rejected without changing the table", () => {
    const { elements, submit } = loadDemoWithoutTriage();
    for (const age of ["-1", "121", "12.5", "abc"]) {
        submit("Fictional Sample", age);
    }
    assert.equal(elements.patientCount.textContent, "0");
    assert.equal(elements.patientTable.children.length, 1);
    assert.equal(elements.patientTable.children[0].id, "emptyRow");
});
