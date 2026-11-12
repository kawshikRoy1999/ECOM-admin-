/*
    Shared invoice field handling for the printed invoice views.

    The gateway builds the invoice HTML by substituting template placeholders,
    and it emits a field's label even when the value is blank. That leaves runs
    like "... West Bengal Phone: Contact: Email: x@y.com GSTIN: 27ABCDE1234F1Z5"
    with two labels that carry nothing.

    Used by:
      Views/Invoice/InvoicePdf.cshtml        - A4: drops the empty labels in place
      Views/Invoice/_InvoiceThermalPdf.cshtml - 80mm: also splits fields onto
                                                their own lines

    Vanilla JS on purpose - the PDF layout's jQuery must not be a dependency.
*/
(function (global) {
    "use strict";

    // Longest first, so "GST No" wins over "GST" and "State Code" over "State".
    var LABELS = [
        "GSTIN", "GST No", "GST No.", "GST", "PAN", "CIN", "FSSAI", "TIN", "VAT",
        "Telephone", "Phone", "Mobile", "Contact", "Tel", "Fax",
        "E-mail", "Email", "Website", "Web",
        "State Code", "State", "Landmark", "PIN Code", "Pin Code", "PIN"
    ];

    function labelAlternation() {
        return LABELS.slice()
            .sort(function (a, b) { return b.length - a.length; })
            .map(function (l) {
                return l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
            })
            .join("|");
    }
    // \b is zero-width on purpose. Consuming a leading separator would swallow the
    // space between back-to-back empty labels ("Phone: Contact:"), leaving the
    // second one unmatched and read as the first one's value.
    // \b also keeps "Telephone:" from being read as "Tel:".
    var LABEL_RE = new RegExp("\\b((?:" + labelAlternation() + "))\\s*:\\s*", "gi");

    // A value is real only if it carries a letter, digit or "@".
    // Leftovers like ":", "-" or "N/A" count as empty.
    function hasContent(v) {
        v = (v || "").trim();
        if (!v) { return false; }
        if (/^(n\/?a|nil|none|null|undefined|-+|\.+)$/i.test(v)) { return false; }
        return /[A-Za-z0-9@]/.test(v);
    }

    // "Addr Phone: Contact: Email: x GSTIN: y"
    //   -> { lead: "Addr", fields: [Phone:"", Contact:"", Email:"x", GSTIN:"y"] }
    function splitFields(text) {
        text = (text || "").replace(/\s+/g, " ");
        var fields = [], lead = "", pending = null, last = 0, m;
        LABEL_RE.lastIndex = 0;
        while ((m = LABEL_RE.exec(text))) {
            var chunk = text.slice(last, m.index).trim();
            if (pending) { pending.value = chunk; fields.push(pending); }
            else { lead = chunk; }
            pending = { label: m[1].trim(), value: "" };
            last = LABEL_RE.lastIndex;
        }
        if (pending) { pending.value = text.slice(last).trim(); fields.push(pending); }
        else { lead = text.trim(); }
        return { lead: lead, fields: fields };
    }

    function nonEmptyFields(parsed) {
        return parsed.fields.filter(function (f) { return hasContent(f.value); });
    }

    function isBoldValue(root, value) {
        var marks = root.querySelectorAll("strong,b");
        for (var i = 0; i < marks.length; i++) {
            if (marks[i].textContent.replace(/\s+/g, " ").trim() === value) { return true; }
        }
        return false;
    }

    function visibleText(root) {
        var walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        var parts = [], n;
        while ((n = walker.nextNode())) {
            var hid = false;
            for (var e = n.parentNode; e && e !== root; e = e.parentNode) {
                if (e.nodeType !== 1) { continue; }
                var s = global.getComputedStyle(e);
                if (s && (s.display === "none" || s.visibility === "hidden")) { hid = true; break; }
            }
            if (hid) { continue; }
            var t = n.nodeValue.replace(/\s+/g, " ").trim();
            if (t) { parts.push(t); }
        }
        return parts.join(" ").replace(/\s+/g, " ").trim();
    }

    /*
        Removes labels with no value, in place.

        Only rewrites an element when it actually has an empty field, so the
        template's own markup and styling are left alone everywhere else.
        Values that were bold stay bold.
    */
    function stripEmptyFields(root) {
        if (!root) { return 0; }
        var removed = 0;
        var blocks = root.querySelectorAll("p,div,span,td,th,li,h1,h2,h3,h4,h5,h6,address");
        Array.prototype.forEach.call(blocks, function (elm) {
            // Leaf blocks only - a container's text is handled by its children.
            if (elm.querySelector("p,div,td,th,li,h1,h2,h3,h4,h5,h6,address,table")) { return; }

            var text = visibleText(elm);
            if (!text) { return; }

            var parsed = splitFields(text);
            if (!parsed.fields.length) { return; }

            var keep = nonEmptyFields(parsed);
            if (keep.length === parsed.fields.length) { return; }   // nothing empty
            removed += parsed.fields.length - keep.length;

            var doc = elm.ownerDocument;
            var frag = doc.createDocumentFragment();
            if (parsed.lead) { frag.appendChild(doc.createTextNode(parsed.lead + " ")); }
            keep.forEach(function (f, i) {
                if (i) { frag.appendChild(doc.createTextNode(" ")); }
                frag.appendChild(doc.createTextNode(f.label + ": "));
                if (isBoldValue(elm, f.value)) {
                    var b = doc.createElement("strong");
                    b.textContent = f.value;
                    frag.appendChild(b);
                } else {
                    frag.appendChild(doc.createTextNode(f.value));
                }
            });
            elm.innerHTML = "";
            elm.appendChild(frag);
        });
        return removed;
    }

    global.InvoiceFields = {
        LABELS: LABELS,
        hasContent: hasContent,
        splitFields: splitFields,
        nonEmptyFields: nonEmptyFields,
        stripEmptyFields: stripEmptyFields
    };
}(window));
