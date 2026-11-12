(function () {
    "use strict";

    var out = document.getElementById("thermal-out");
    if (!out) { return; }

    // ---------------------------------------------------------------- helpers
    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) { n.className = cls; }
        if (text != null) { n.textContent = text; }
        return n;
    }
    function rule(solid) { return el("div", solid ? "rcpt-rule-solid" : "rcpt-rule"); }
    function pair(cls, label, value) {
        var r = el("div", "rcpt-row" + (cls ? " " + cls : ""));
        r.appendChild(el("span", "k", label));
        r.appendChild(el("span", "v", value));
        return r;
    }

    function hidden(node) {
        if (!node || node.nodeType !== 1) { return false; }
        var s = window.getComputedStyle(node);
        return !s || s.display === "none" || s.visibility === "hidden";
    }
    function hiddenAncestor(node, stopAt) {
        for (var n = node; n && n !== stopAt; n = n.parentNode) {
            if (hidden(n)) { return true; }
        }
        return false;
    }

    // Text of an element, joining across element boundaries so adjacent cells or
    // spans do not run together ("HSNQty", "AcmeInvoice"). Skips hidden subtrees.
    function textOf(root) {
        if (!root) { return ""; }
        if (root.nodeType === 1 && hidden(root)) { return ""; }
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        var parts = [], n;
        while ((n = walker.nextNode())) {
            if (hiddenAncestor(n.parentNode, root)) { continue; }
            var t = n.nodeValue.replace(/\s+/g, " ").trim();   // \s covers &nbsp;
            if (t) { parts.push(t); }
        }
        return parts.join(" ").replace(/\s+/g, " ").trim();
    }

    // Is this text inside <strong>/<b>, or something the template styles bold?
    function isBold(node, root) {
        for (var e = node; e && e !== root.parentNode; e = e.parentNode) {
            if (e.nodeType !== 1) { continue; }
            if (e.tagName === "STRONG" || e.tagName === "B") { return true; }
            var w = window.getComputedStyle(e).fontWeight;
            if (w === "bold" || w === "bolder" || parseInt(w, 10) >= 600) { return true; }
        }
        return false;
    }

    // Text split into runs, each flagged with whether the template emphasises it.
    function textRuns(root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        var runs = [], n;
        while ((n = walker.nextNode())) {
            if (hiddenAncestor(n.parentNode, root)) { continue; }
            var t = n.nodeValue.replace(/\s+/g, " ").trim();
            if (t) { runs.push({ text: t, bold: isBold(n.parentNode, root) }); }
        }
        return runs;
    }
    function fragFromRuns(runs) {
        var frag = document.createDocumentFragment();
        runs.forEach(function (r, i) {
            if (i) { frag.appendChild(document.createTextNode(" ")); }
            frag.appendChild(r.bold ? el("b", null, r.text) : document.createTextNode(r.text));
        });
        return frag;
    }
    // Same text as textOf(), but keeps the template's own emphasis instead of
    // flattening it - the invoice already marks what deserves bold.
    function richText(root) { return fragFromRuns(textRuns(root)); }

    // Section headers that introduce an address block. Bolded even when the
    // template leaves them plain, so the receipt shows where each party starts.
    var SECTION_LABEL = /^(bill(ed)?\s*to|ship(ped)?\s*to|sold\s*by|deliver(y|ed)?\s*to|consignee|buyer|seller)\b[:\s]*/i;

    // Rebuilds the lead text of a block, keeping the emphasis the template gave
    // it; if it gave none, bolds a leading "Bill To" / "Ship To" style header.
    function leadFragment(child, lead) {
        var runs = textRuns(child), take = [], acc = "";
        for (var i = 0; i < runs.length; i++) {
            var next = acc ? acc + " " + runs[i].text : runs[i].text;
            if (next.length <= lead.length) { take.push(runs[i]); acc = next; continue; }
            var rest = lead.slice(acc ? acc.length + 1 : 0).trim();
            if (rest) { take.push({ text: rest, bold: runs[i].bold }); }
            break;
        }
        // Bold the section header itself even when other parts of the line are
        // already emphasised (a bold phone number further along, say).
        var m = SECTION_LABEL.exec(lead);
        if (m && take.length && !take[0].bold) {
            var headLen = m[0].replace(/[:\s]+$/, "").length;
            var first = take[0].text;
            if (first.length >= headLen) {
                var split = [{ text: first.slice(0, headLen), bold: true }];
                var tail = first.slice(headLen).trim();
                if (tail) { split.push({ text: tail, bold: false }); }
                take = split.concat(take.slice(1));
            }
        }
        return take.length ? fragFromRuns(take) : document.createTextNode(lead);
    }

    function invoiceFields() { return window.InvoiceFields || null; }

    // A block like
    //   "Super Retail BUS STAND, ... Phone: Contact: Email: x GSTIN: 27ABC"
    // packs the address and several contact fields into one run. On 80mm that
    // wraps into an unreadable paragraph, so give each field its own row and
    // drop the ones the gateway emitted with no value ("Phone:", "Contact:").
    // Returns null when the block holds no such fields.
    function fieldRows(child, text) {
        var api = invoiceFields();
        if (!api) { return null; }
        var parsed = api.splitFields(text);
        if (!parsed.fields.length) { return null; }
        var keep = api.nonEmptyFields(parsed);
        if (!keep.length && !parsed.lead) { return null; }

        var nodes = [];
        if (parsed.lead) {
            var line = el("div", "rcpt-line");
            line.appendChild(leadFragment(child, parsed.lead));
            nodes.push(line);
        }
        keep.forEach(function (f) { nodes.push(pair(null, f.label, f.value)); });
        return nodes.length ? nodes : null;
    }

    // These templates double as the order e-mail body, so they carry a line of
    // e-mail prose ("Your order SS-O/26-27/84 has been successfully ...") that
    // has no place on a POS receipt. Widen this if other wording shows up.
    var EMAIL_PROSE = /^\s*(your|the)\s+order\b.*\b(has\s+been|is|was)\b/i;

    // "Invoice No: INV-1024" / "Order No:ORD-99" -> ["Invoice No", "INV-1024"]
    function splitPair(s) {
        var m = /^([^:]{1,40}?)\s*:\s*(.+)$/.exec(s);
        return m ? [m[1].trim(), m[2].trim()] : null;
    }

    // One block often holds several pairs:
    //   Invoice No <strong>SS-I/26-27/63</strong> Invoice Date: <strong>01/09/2026</strong>
    // Splitting on a colon merges them into one wrong row, so use the <strong>
    // runs the template already puts around every value: each bold run is a
    // value, and the plain text just before it is its label.
    // Returns null when that reading does not hold (e.g. a long address
    // paragraph that merely happens to end in a bold GSTIN).
    function boldPairs(root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        var pairs = [], label = "", sawBold = false, n;
        while ((n = walker.nextNode())) {
            if (hiddenAncestor(n.parentNode, root)) { continue; }
            var t = n.nodeValue.replace(/\s+/g, " ").trim();
            if (!t) { continue; }
            if (isBold(n.parentNode, root)) {
                sawBold = true;
                var k = label.replace(/[\s:]+$/, "").trim();
                if (!k || k.length > 40) { return null; }
                pairs.push([k, t]);
                label = "";
            } else {
                label += " " + t;
            }
        }
        // Trailing prose after the last value means this is not a clean pair list.
        if (!sawBold || label.trim().length > 2) { return null; }
        return pairs.length ? pairs : null;
    }

    function cells(tr) { return Array.prototype.slice.call(tr.cells || []); }
    function rowTexts(tr) { return cells(tr).map(textOf); }

    // Column classification. These decide WHERE a value lands on the receipt -
    // every column is rendered either way, none are discarded.
    var QTY_COL    = /\b(qty|quantity|nos)\b/i;
    var RATE_COL   = /\b(rate|price|mrp|unit)\b/i;
    var AMT_COL    = /\b(amt|amount|total|value)\b/i;   // matches "Amt(Rs)"
    var NAME_COL   = /\b(item|description|particular|product|goods|name)\b/i;
    var SERIAL_COL = /^(#|s\.?\s*no\.?|sl\.?\s*no\.?|sr\.?\s*no\.?|sno|slno|srno)$/i;
    var GRAND      = /(grand\s*total|net\s*payable|total\s*payable|amount\s*payable|net\s*total|payable\s*amount)/i;

    var BLOCK_SEL = "p,div,h1,h2,h3,h4,h5,h6,table,ul,ol,li,tr,section,article,header,footer,blockquote,address";

    function findItemsTable(src) {
        var tables = Array.prototype.slice.call(src.querySelectorAll("table"));
        for (var i = 0; i < tables.length; i++) {
            var t = tables[i];
            if (t.querySelector("table") || hidden(t) || !t.rows.length) { continue; }
            var h = rowTexts(t.rows[0]).join(" ");
            if (QTY_COL.test(h) && AMT_COL.test(h)) { return t; }
        }
        return null;
    }

    // ------------------------------------------------------------ items table
    function renderItems(table, dest) {
        var headTexts = rowTexts(table.rows[0]);

        var idx = { name: -1, qty: -1, rate: -1, amt: -1, serial: -1 };
        headTexts.forEach(function (h, n) {
            if (idx.serial === -1 && SERIAL_COL.test(h)) { idx.serial = n; return; }
            if (idx.qty    === -1 && QTY_COL.test(h))    { idx.qty    = n; return; }
            if (AMT_COL.test(h))                         { idx.amt    = n; return; } // last wins
            if (idx.rate   === -1 && RATE_COL.test(h))   { idx.rate   = n; return; }
            if (idx.name   === -1 && NAME_COL.test(h))   { idx.name   = n; }
        });
        if (idx.name === -1) {
            for (var c = 0; c < headTexts.length; c++) {
                if (c !== idx.serial && c !== idx.qty && c !== idx.rate && c !== idx.amt) {
                    idx.name = c; break;
                }
            }
        }

        // Column headings come from the source table, not from this view.
        dest.appendChild(rule());
        var ih = el("div", "rcpt-items-head");
        ih.appendChild(el("span", "nm",  idx.name >= 0 ? headTexts[idx.name] : ""));
        ih.appendChild(el("span", "amt", idx.amt  >= 0 ? headTexts[idx.amt]  : ""));
        dest.appendChild(ih);
        dest.appendChild(rule(true));

        var itemsBox  = el("div");
        var totalsBox = document.createDocumentFragment();
        var grandRow  = null;

        Array.prototype.slice.call(table.rows).slice(1).forEach(function (tr) {
            if (hidden(tr)) { return; }
            var tds = cells(tr);
            if (!tds.length) { return; }

            var texts  = rowTexts(tr);
            var values = texts.filter(function (t) { return t !== ""; });
            if (!values.length) { return; }

            var spanned = tds.some(function (td) {
                return parseInt(td.getAttribute("colspan") || "1", 10) > 1;
            });

            // Totals row: merged cells, or simply fewer cells than the header.
            if (spanned || tds.length < headTexts.length) {
                var label = values.slice(0, -1).join(" ") || values[0];
                var value = values.length > 1 ? values[values.length - 1] : "";
                if (GRAND.test(label)) {
                    grandRow = el("div", "rcpt-grand");
                    grandRow.appendChild(el("span", null, label));
                    grandRow.appendChild(el("span", null, value));
                } else {
                    totalsBox.appendChild(pair("rcpt-total-row", label, value));
                }
                return;
            }

            var name   = idx.name   >= 0 ? (texts[idx.name]   || "") : values[0];
            var qty    = idx.qty    >= 0 ? (texts[idx.qty]    || "") : "";
            var rate   = idx.rate   >= 0 ? (texts[idx.rate]   || "") : "";
            var amt    = idx.amt    >= 0 ? (texts[idx.amt]    || "") : "";
            var serial = idx.serial >= 0 ? (texts[idx.serial] || "") : "";
            if (!name && !amt) { return; }

            var item = el("div", "rcpt-item");
            item.appendChild(el("div", "rcpt-item-name", serial ? serial + ". " + name : name));

            var calc = el("div", "rcpt-item-calc");
            calc.appendChild(el("span", "qty", qty && rate ? qty + " x " + rate : (qty || rate)));
            calc.appendChild(el("span", "amt", amt));
            item.appendChild(calc);

            // Every column not already placed above, kept with its own heading.
            var rest = [];
            texts.forEach(function (v, n) {
                if (n === idx.name || n === idx.qty || n === idx.rate ||
                    n === idx.amt  || n === idx.serial || !v) { return; }
                rest.push(headTexts[n] ? headTexts[n] + ": " + v : v);
            });
            if (rest.length) { item.appendChild(el("div", "rcpt-item-meta", rest.join("  |  "))); }

            itemsBox.appendChild(item);
        });

        dest.appendChild(itemsBox);
        dest.appendChild(rule(true));
        dest.appendChild(totalsBox);
        if (grandRow) { dest.appendChild(grandRow); }
    }

    // ------------------------------------------------------------- DOM walker
    // The template is <div>/<p> blocks, not tables, so emit a line per leaf
    // block and hand the item table off to renderItems.
    function walk(node, ctx) {
        Array.prototype.slice.call(node.children).forEach(function (child) {
            if (hidden(child)) { return; }          // respects the template's own display:none

            if (child === ctx.itemsTable) {
                renderItems(child, ctx.dest);
                ctx.produced = true;
                return;
            }
            if (ctx.itemsTable && child.contains(ctx.itemsTable)) {
                walk(child, ctx);
                return;
            }
            // A block with nested blocks is structure - descend.
            if (child.querySelector(BLOCK_SEL)) { walk(child, ctx); return; }

            var text = textOf(child);
            if (!text) { return; }
            if (EMAIL_PROSE.test(text)) { return; }

            if (/^H[1-6]$/.test(child.tagName)) {
                ctx.dest.appendChild(el("div", ctx.headings++ ? "rcpt-h2" : "rcpt-h1", text));
            } else {
                var bp = boldPairs(child);
                var fp = bp ? null : fieldRows(child, text);
                var kv = (bp || fp) ? null : splitPair(text);

                if (bp) {
                    bp.forEach(function (p) { ctx.dest.appendChild(pair(null, p[0], p[1])); });
                } else if (fp) {
                    fp.forEach(function (n) { ctx.dest.appendChild(n); });
                } else if (kv) {
                    ctx.dest.appendChild(pair(null, kv[0], kv[1]));
                } else {
                    var line = el("div", "rcpt-line");
                    line.appendChild(leadFragment(child, text));
                    ctx.dest.appendChild(line);
                }
            }
            ctx.produced = true;
        });
    }

    function render(src, dest) {
        var ctx = { dest: dest, itemsTable: findItemsTable(src), headings: 0, produced: false };

        // Logo hoisted to the top - on 80mm it cannot sit beside the address.
        var imgs = Array.prototype.slice.call(src.querySelectorAll("img"));
        for (var i = 0; i < imgs.length; i++) {
            if (!hiddenAncestor(imgs[i], src) && imgs[i].getAttribute("src")) {
                var l = el("img", "rcpt-logo");
                l.src = imgs[i].getAttribute("src");
                l.alt = "";
                dest.appendChild(l);
                break;
            }
        }

        walk(src, ctx);
        return ctx.produced;
    }

    // ------------------------------------------------------------------ build
    // The A4 view prints Model.html and Model.htmlc side by side; a roll has no
    // second column, so they stack.
    var src  = document.getElementById("thermal-src");
    var srcc = document.getElementById("thermal-srcc");

    var ok = src ? render(src, out) : false;
    if (srcc && textOf(srcc)) {
        var second = el("div");
        if (render(srcc, second)) {
            out.appendChild(el("div", "rcpt-copy-gap"));
            out.appendChild(rule());
            out.appendChild(second);
            ok = true;
        }
    }

    // Nothing recognisable - print the original rather than a blank slip.
    if (!ok) {
        if (src)  { src.className = ""; }
        if (srcc) { srcc.className = ""; }
        out.style.display = "none";
        return;
    }

    // --------------------------------------------------- print once images load
    var printed = false;
    function doPrint() {
        if (printed) { return; }
        printed = true;
        window.print();
    }
    var pending = Array.prototype.slice.call(out.querySelectorAll("img"))
        .filter(function (im) { return !im.complete; });
    if (pending.length) {
        var left = pending.length;
        pending.forEach(function (im) {
            function done() { if (--left === 0) { doPrint(); } }
            im.addEventListener("load", done);
            im.addEventListener("error", done);
        });
    }
    setTimeout(doPrint, pending.length ? 2500 : 300);
}());
