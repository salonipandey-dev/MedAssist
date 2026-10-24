"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const script = readFileSync(join(__dirname, "../js/app.js"), "utf8");

function makeElement(id = "") {
    return {
        id,
        value: "",
        textContent: "",
        disabled: false,
        children: [],
        listeners: {},
        style: {},
        classList: { add() {}, remove() {} },
        setAttribute() {},
        insertAdjacentElement(_position, child) { this.status = child; },
        addEventListener(event, handler) { this.listeners[event] = handler; },
        appendChild(child) {
            child.parent = this;
            this.children.push(child);
            return child;
        },
        remove() {
            if (this.parent) {
                this.parent.children = this.parent.children.filter((child) => child !== this);
            }
        },
        replaceChildren(...children) {
            this.children = [];
            children.forEach((child) => this.appendChild(child));
        },
        replaceWith() {},
        reset() {},
    };
}

function setup() {
    const ids = [
        "patientForm", "triageForm", "patientTable", "patientCount",
        "clearDemoEntries", "patientName", "patientAge", "patientGender",
        "patientPhone", "triageResult", "totalAssessments", "latestRisk",
    ];
    const elements = Object.fromEntries(ids.map((id) => [id, makeElement(id)]));
    elements.patientCount.textContent = "0";
    const empty = makeElement("emptyRow");
    elements.patientTable.appendChild(empty);

    const document = {
        createElement: () => makeElement(),
        getElementById(id) {
            if (id === "emptyRow") {
                return elements.patientTable.children.find((row) => row.id === id) ?? null;
            }
            return elements[id] ?? null;
        },
        querySelectorAll: () => [],
    };

    vm.runInNewContext(script, { document });
    const submit = (name, age) => {
        elements.patientName.value = name;
        elements.patientAge.value = age;
        elements.patientGender.value = "Other";
        elements.patientPhone.value = "0000000000";
        elements.patientForm.listeners.submit({ preventDefault() {} });
    };
    return { elements, submit };
}

test("fictional entries render as text and enable clearing", () => {
    const { elements, submit } = setup();
    assert.equal(elements.clearDemoEntries.disabled, true);
    submit("<script>alert(1)</script>", "27");
    assert.equal(elements.patientTable.children.length, 1);
    assert.equal(elements.patientTable.children[0].children[0].textContent, "<script>alert(1)</script>");
    assert.equal(elements.patientCount.textContent, "1");
    assert.equal(elements.clearDemoEntries.disabled, false);
});

test("clear control empties the table and restores the placeholder", () => {
    const { elements, submit } = setup();
    submit("Demo Patient A", "30");
    submit("Demo Patient B", "31");
    elements.clearDemoEntries.listeners.click();
    assert.equal(elements.patientCount.textContent, "0");
    assert.equal(elements.patientTable.children.length, 1);
    assert.equal(elements.patientTable.children[0].id, "emptyRow");
    assert.equal(elements.patientTable.children[0].children[0].colSpan, 4);
    assert.equal(elements.clearDemoEntries.disabled, true);
    assert.match(elements.patientForm.status.textContent, /cleared/);
    submit("Demo Patient C", "32");
    assert.equal(elements.patientTable.children.length, 1);
    assert.equal(elements.patientCount.textContent, "1");
});

test("invalid age cannot create a demo entry", () => {
    const { elements, submit } = setup();
    for (const age of ["-1", "121", "abc", "18.5"]) {
        submit("Demo Patient", age);
    }
    assert.equal(elements.patientCount.textContent, "0");
    assert.equal(elements.patientTable.children.length, 1);
    assert.equal(elements.clearDemoEntries.disabled, true);
});
