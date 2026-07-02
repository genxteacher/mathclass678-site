/* ============================================================================
   build_site.js — mathclass678.com static-site generator
   Reads:  Master_Catalog_Skills.csv (catalog ground truth)
           ICan_Statements_Master.csv (product-card copy)
   Emits:  dist/  (flat static site, drag-deployable to Netlify)
   Run:    node build_site.js
   Authored by Claude. Regenerate whole site each session — never hand-edit dist/.
   ============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SITE_URL = 'https://mathclass678.com';
const TPT_STORE = 'https://www.teacherspayteachers.com/store/math-class-678';
const CONTACT = { tpt: 'tpt@mathclass678.com', support: 'support@mathclass678.com' };
const SOCIAL = { pinterest: 'https://www.pinterest.com/mathclass678', instagram: 'https://www.instagram.com/mathclass.678', tiktok: 'https://www.tiktok.com/@mathclass678' };
const KIT = { uid: 'bd0030d799', url: 'https://mathclass678.kit.com/bd0030d799' };
const KIT_SCRIPT = `<script async data-uid="bd0030d799" src="https://mathclass678.kit.com/bd0030d799/index.js"></` + `script>`;

/* ----------------------------------------------------------------------------
   TPT review data — OPTIONAL, off by default.
   AggregateRating / Review schema emits on the homepage ONLY when this is
   populated with GENUINE figures from the live TPT storefront. Google requires
   reviews to be real and verifiable; do not invent ratings or counts.

   To activate: fill in the real store-wide numbers from the TPT dashboard.
     ratingValue  = average store rating (e.g. 4.9) — TPT shows this on the store page
     reviewCount  = total number of ratings across the store
   Optionally add up to a few real, attributed quotes to REVIEWS (author = the
   reviewer's TPT display name exactly as shown, datePublished = YYYY-MM-DD).
   Leave TPT_RATING = null to ship no rating schema at all.
---------------------------------------------------------------------------- */
const TPT_RATING = null; // Set to e.g. { ratingValue: 4.9, reviewCount: 1200 } using GENUINE store-wide TPT figures to activate AggregateRating + Review schema and the visible star line.
const REVIEWS = [        // Genuine attributed TPT reviews — emit as Review schema only when TPT_RATING is also set.
  { author: 'Lauren K.', rating: 5, body: 'I used this 6th grade unit rate skill sheet in my classroom, and it made the lesson flow so smoothly. The reference, practice, and exit ticket were all in one place, and my students had plenty of practice without feeling overwhelmed.', datePublished: '2026-06-01' },
  { author: 'Megan T.', rating: 5, body: 'Exactly what I needed for two-step equations. My students usually get lost when we move from guided notes to independent practice, but this sheet made the progression feel natural, and the answer key showed the steps instead of just giving the final answer.', datePublished: '2026-05-20' },
  { author: 'Rachel B.', rating: 5, body: 'The examples were clear enough for absent students to use later. I also used the editable slides the next day for a quick reteach, which made the resource feel more like a mini lesson than just a worksheet.', datePublished: '2026-06-08' }
];

/* ---------- tiny CSV parser (honors quoted fields, CRLF) ---------- */
function parseCSV(text) {
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}
function csvToObjects(text) {
  const rows = parseCSV(text);
  const hdr = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => { const o = {}; hdr.forEach((h, i) => o[h] = (r[i] || '').trim()); return o; });
}

/* ---------- helpers ---------- */
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cleanCCSS = c => String(c || '').split('-')[0].trim();
const gradeNum = g => (String(g).match(/(\d)/) || [])[1] || '';
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const STRAND_NAME = {
  EE: 'Expressions & Equations',
  NS: 'The Number System',
  RP: 'Ratios & Proportional Relationships',
  SP: 'Statistics & Probability',
  G:  'Geometry',
  F:  'Functions'
};
function strandOf(ccss) {
  const parts = cleanCCSS(ccss).split('.');
  return parts[1] || '';
}

/* ---------- load data ---------- */
const catalog = csvToObjects(fs.readFileSync(path.join(ROOT, 'Master_Catalog_Skills.csv'), 'utf8'));
const icanRows = csvToObjects(fs.readFileSync(path.join(ROOT, 'ICan_Statements_Master.csv'), 'utf8'));

// I-Can lookup by TPT URL (catalog/gap-fill sources only; skip authored Algebra rows)
const icanByUrl = {};
icanRows.forEach(r => {
  if (r.Source === 'authored') return;
  if (r.PairURL && !icanByUrl[r.PairURL]) icanByUrl[r.PairURL] = r.Statement;
});

// Accurate "Students learn to ___" statements for sheets without an I-Can match.
// Authored to each skill + standard (avoids mis-borrowing a CCSS sibling's statement).
const DESC_OVERRIDE = {
  '27': 'draw quadrilaterals on the coordinate plane and use coordinates to find side lengths',
  '51': 'develop probability models and use them to find the probability of events',
  '53': 'describe opposite quantities and recognize that a number and its opposite sum to zero',
  '58': 'use data from a random sample to draw inferences about a whole population',
  '60': 'compare two populations using measures of center and variability',
  '71': 'apply the properties of integer exponents to simplify expressions',
  '74': 'add, subtract, multiply, and divide numbers written in scientific notation',
  '84': 'approximate irrational numbers and locate them on a number line',
  '90': 'reflect figures across lines on the coordinate plane and describe the result',
  '91': 'rotate figures about a point and describe the effect on the coordinates',
  '94': 'use dilations and rigid motions to show that two figures are similar',
  '102': 'interpret the slope and intercept of a line that models scatter-plot data'
};

/* ----- CCSS full-standard text (clean leaf codes; authored S2) ----- */
const CCSS_TEXT = {
  "6.EE.A.1": "Write and evaluate numerical expressions involving whole-number exponents.",
  "6.EE.A.2a": "Write expressions that record operations with numbers and with letters standing for numbers.",
  "6.EE.A.2b": "Identify parts of an expression using mathematical terms such as sum, term, product, factor, quotient, and coefficient.",
  "6.EE.A.2c": "Evaluate expressions at specific values of their variables, including expressions that arise from real-world problems.",
  "6.EE.A.3": "Apply the properties of operations to generate equivalent expressions.",
  "6.EE.A.3+A.4": "Apply the properties of operations to generate equivalent expressions, and identify when two expressions are equivalent no matter what value is substituted.",
  "6.EE.A.4": "Identify when two expressions are equivalent, meaning they name the same number regardless of which value is substituted into them.",
  "6.EE.B.5+B.6": "Understand that solving an equation or inequality means finding the values that make it true, and use variables to represent numbers in real-world and mathematical problems.",
  "6.EE.B.7": "Solve real-world and mathematical problems by writing and solving equations of the form x + p = q and px = q for non-negative rational numbers.",
  "6.EE.B.8": "Write an inequality of the form x > c or x < c to represent a constraint, and represent its solutions on a number line diagram.",
  "6.EE.C.9": "Use variables to represent two quantities that change in relationship to one another, distinguishing the dependent and independent variables.",
  "6.G.A.1": "Find the area of right triangles, other triangles, special quadrilaterals, and polygons by composing or decomposing them into known shapes.",
  "6.G.A.2": "Find the volume of a right rectangular prism with fractional edge lengths, and apply the volume formulas in real-world problems.",
  "6.G.A.3": "Draw polygons in the coordinate plane given the coordinates of the vertices, and use coordinates to find the length of a side.",
  "6.G.A.4": "Represent three-dimensional figures using nets made of rectangles and triangles, and use the nets to find surface area.",
  "6.NS.A.1": "Interpret and compute quotients of fractions, and solve word problems involving division of fractions by fractions.",
  "6.NS.B.2+B.3": "Fluently divide multi-digit numbers and add, subtract, multiply, and divide multi-digit decimals using the standard algorithm.",
  "6.NS.B.4": "Find the greatest common factor and the least common multiple of two numbers, and use the distributive property to rewrite a sum.",
  "6.NS.C.5+C.6a": "Understand that positive and negative numbers describe quantities with opposite directions or values, and recognize opposite signs as locations on opposite sides of zero.",
  "6.NS.C.6b": "Understand signs of numbers in ordered pairs as indicating locations in the four quadrants of the coordinate plane.",
  "6.NS.C.6c": "Find and position integers and other rational numbers on a horizontal or vertical number line and in the coordinate plane.",
  "6.NS.C.7": "Understand ordering and absolute value of rational numbers, and interpret absolute value as distance from zero.",
  "6.NS.C.8": "Solve real-world and mathematical problems by graphing points in all four quadrants of the coordinate plane.",
  "6.RP.A.1": "Understand the concept of a ratio and use ratio language to describe a relationship between two quantities.",
  "6.RP.A.2": "Understand the concept of a unit rate associated with a ratio, and use rate language in the context of a ratio relationship.",
  "6.RP.A.3": "Use ratio and rate reasoning to solve real-world and mathematical problems, using tables, tape diagrams, double number lines, and percents.",
  "6.SP.A.1": "Recognize a statistical question as one that anticipates variability in the data related to the question.",
  "6.SP.A.2": "Understand that a set of data collected to answer a statistical question has a distribution described by its center, spread, and overall shape.",
  "6.SP.A.3": "Recognize that a measure of center summarizes a data set with a single number, while a measure of variation describes how the values vary.",
  "6.SP.B.4": "Display numerical data in plots on a number line, including dot plots, histograms, and box plots.",
  "6.SP.B.5": "Summarize numerical data sets in relation to their context, reporting the number of observations and describing center and variability.",
  "7.EE.A.1": "Apply properties of operations to add, subtract, factor, and expand linear expressions with rational coefficients.",
  "7.EE.A.2": "Understand that rewriting an expression in different forms can show how the quantities in a problem are related.",
  "7.EE.B.3": "Solve multi-step real-life and mathematical problems with positive and negative rational numbers in any form, and assess the reasonableness of answers.",
  "7.EE.B.4a": "Solve word problems leading to equations of the form px + q = r and p(x + q) = r, and compare an algebraic solution to an arithmetic one.",
  "7.EE.B.4b": "Solve word problems leading to inequalities of the form px + q > r or px + q < r, graph the solution set, and interpret it in context.",
  "7.G.A.1": "Solve problems involving scale drawings of geometric figures, including computing actual lengths and areas and reproducing a drawing at a different scale.",
  "7.G.A.2": "Draw geometric shapes with given conditions, focusing on constructing triangles from three measures of angles or sides.",
  "7.G.A.3": "Describe the two-dimensional figures that result from slicing three-dimensional figures, such as plane sections of right prisms and pyramids.",
  "7.G.B.4": "Know the formulas for the area and circumference of a circle, and use them to solve problems and explain the relationship between them.",
  "7.G.B.5": "Use facts about supplementary, complementary, vertical, and adjacent angles to write and solve simple equations for an unknown angle.",
  "7.G.B.6": "Solve real-world and mathematical problems involving area, volume, and surface area of two- and three-dimensional objects.",
  "7.NS.A.1a": "Describe situations in which opposite quantities combine to make zero.",
  "7.NS.A.1b": "Understand addition of rational numbers; a number and its opposite sum to zero, and sums can be shown on a number line.",
  "7.NS.A.1c": "Understand subtraction of rational numbers as adding the additive inverse, and show that distance on a number line is the absolute value of the difference.",
  "7.NS.A.1d": "Apply properties of operations as strategies to add and subtract rational numbers.",
  "7.NS.A.2a": "Understand multiplication of rational numbers by extending the properties of operations, including the rules for multiplying signed numbers.",
  "7.NS.A.2b": "Understand that integers can be divided, that the quotient of integers is a rational number, and how the sign of a quotient is determined.",
  "7.NS.A.2c": "Apply properties of operations as strategies to multiply and divide rational numbers.",
  "7.NS.A.2d": "Convert a rational number to a decimal using long division, and know that the decimal form terminates or eventually repeats.",
  "7.NS.A.3": "Solve real-world and mathematical problems involving the four operations with rational numbers.",
  "7.RP.A.1": "Compute unit rates associated with ratios of fractions, including ratios of lengths, areas, and other quantities measured in like or different units.",
  "7.RP.A.2": "Recognize and represent proportional relationships between quantities, identifying the constant of proportionality and writing equations of the form y = kx.",
  "7.RP.A.3": "Use proportional relationships to solve multistep ratio and percent problems, including simple interest, tax, markups, markdowns, and percent change.",
  "7.SP.A.1": "Understand that statistics can be used to gain information about a population by examining a representative sample of it.",
  "7.SP.A.2": "Use data from a random sample to draw inferences about a population, and gauge the variation in estimates from multiple samples.",
  "7.SP.B.3": "Informally assess the degree of visual overlap of two numerical data distributions with similar variabilities.",
  "7.SP.B.4": "Use measures of center and measures of variability to draw informal comparative inferences about two populations.",
  "7.SP.C.5": "Understand that the probability of a chance event is a number between 0 and 1 that expresses how likely the event is to occur.",
  "7.SP.C.6": "Approximate the probability of a chance event by collecting data and observing its long-run relative frequency.",
  "7.SP.C.7": "Develop a probability model and use it to find probabilities of events, comparing probabilities from a model to observed frequencies.",
  "7.SP.C.8": "Find probabilities of compound events using organized lists, tables, tree diagrams, and simulation.",
  "8.EE.A.1": "Know and apply the properties of integer exponents to generate equivalent numerical expressions.",
  "8.EE.A.2": "Use square root and cube root symbols to represent solutions to equations, and evaluate the roots of small perfect squares and cubes.",
  "8.EE.A.3": "Use numbers expressed in scientific notation to estimate very large or very small quantities and to compare their sizes.",
  "8.EE.A.4": "Perform operations with numbers expressed in scientific notation, and choose units of appropriate size for measurements.",
  "8.EE.B.5": "Graph proportional relationships, interpret the unit rate as the slope, and compare two proportional relationships represented in different ways.",
  "8.EE.B.6": "Use similar triangles to explain why the slope is the same between any two distinct points on a line, and derive the equation y = mx + b.",
  "8.EE.C.7a": "Give examples of linear equations in one variable with one solution, infinitely many solutions, or no solutions.",
  "8.EE.C.7b": "Solve linear equations with rational number coefficients, including equations that require expanding expressions and collecting like terms.",
  "8.EE.C.8a": "Understand that solutions to a system of two linear equations correspond to the points where their graphs intersect.",
  "8.EE.C.8+C.8b": "Solve systems of two linear equations algebraically, and estimate solutions by graphing the equations.",
  "8.EE.C.8c": "Solve real-world and mathematical problems leading to two linear equations in two variables.",
  "8.F.A.1": "Understand that a function is a rule that assigns to each input exactly one output, and that the graph is the set of ordered pairs.",
  "8.F.A.2": "Compare properties of two functions each represented in a different way, such as a table, graph, equation, or verbal description.",
  "8.F.A.3": "Interpret the equation y = mx + b as defining a linear function whose graph is a straight line, and recognize functions that are not linear.",
  "8.F.B.4": "Construct a function to model a linear relationship between two quantities, determining the rate of change and initial value.",
  "8.F.B.5": "Describe qualitatively the functional relationship between two quantities from a graph, and sketch a graph from a verbal description.",
  "8.G.A.1": "Verify experimentally the properties of rotations, reflections, and translations of lines, line segments, and angles.",
  "8.G.A.2": "Understand that a two-dimensional figure is congruent to another if one can be obtained from the other by a sequence of rigid motions.",
  "8.G.A.3": "Describe the effect of dilations, translations, rotations, and reflections on two-dimensional figures using coordinates.",
  "8.G.A.4": "Understand that a figure is similar to another if one can be obtained from the other by a sequence of rigid motions and dilations.",
  "8.G.A.5": "Use informal arguments to establish facts about angle sums, exterior angles, and angles formed when parallel lines are cut by a transversal.",
  "8.G.B.6": "Explain a proof of the Pythagorean Theorem and its converse.",
  "8.G.B.7": "Apply the Pythagorean Theorem to determine unknown side lengths in right triangles in real-world and mathematical problems in two and three dimensions.",
  "8.G.B.8": "Apply the Pythagorean Theorem to find the distance between two points in a coordinate system.",
  "8.G.C.9": "Know the formulas for the volumes of cones, cylinders, and spheres, and use them to solve real-world and mathematical problems.",
  "8.NS.A.1": "Know that numbers that are not rational are called irrational, and understand that every number has a decimal expansion.",
  "8.NS.A.2": "Use rational approximations of irrational numbers to compare their sizes and to locate them approximately on a number line.",
  "8.SP.A.1": "Construct and interpret scatter plots for bivariate measurement data, describing patterns such as clustering, outliers, and association.",
  "8.SP.A.2": "Know that straight lines are widely used to model relationships between two quantitative variables, and informally fit a line to data.",
  "8.SP.A.3": "Use the equation of a linear model to solve problems, interpreting the slope and intercept in the context of the data.",
  "8.SP.A.4": "Understand patterns of association between two variables in bivariate categorical data, using two-way tables and relative frequencies."
};

/* ----- Per-sheet about paragraphs (SEO body copy; authored S2, keyed by SheetNumber) ----- */
const SHEET_ABOUT = {
  "1": "This 6th grade Order of Operations skill sheet walks students through evaluating numerical expressions in the correct sequence, including expressions with whole-number exponents and grouping symbols. Aligned to CCSS 6.EE.A.1, it pairs a keep-all-year reference page with guided practice, real-world application, and a built-in exit ticket so the full lesson lives on one printable.",
  "2": "Greatest Common Factor for 6th grade gives students a clear method for finding the GCF of two whole numbers and using it to rewrite sums with the distributive property. Built on CCSS 6.NS.B.4, the sheet moves from a worked reference page through sequenced practice and word problems to a short assessment, all in one place.",
  "3": "Least Common Multiple for 6th grade teaches students to find the LCM of two numbers and apply it to real situations like repeating events and shared schedules. Aligned to CCSS 6.NS.B.4, this 4-in-1 sheet covers the concept with a reference page, guided practice, applied problems, and an exit ticket with a full answer key.",
  "4": "Understanding Ratios introduces 6th grade students to ratio language and what it means to compare two quantities by ratio. Aligned to CCSS 6.RP.A.1, the sheet builds from a reference page with worked examples through scaffolded practice and real-world application to a quick assessment, giving you a complete ratios lesson on a single printable.",
  "5": "Unit Rate Concept helps 6th graders find and interpret the unit rate associated with a ratio, the foundation for proportional reasoning later. Aligned to CCSS 6.RP.A.2, this skill sheet pairs a clear reference page with guided notes, sixteen practice problems, applied word problems, and an exit ticket so students leave with the concept secured.",
  "6": "Ratio Reasoning Application puts 6th grade ratio and rate skills to work on real-world and mathematical problems using tables, tape diagrams, and double number lines. Built on CCSS 6.RP.A.3, the sheet carries students from a reference page through application-heavy practice to a built-in assessment, all aligned and classroom-ready.",
  "7": "Statistical Questions teaches 6th graders to recognize a statistical question as one that expects variability in its answers, the entry point to the whole statistics strand. Aligned to CCSS 6.SP.A.1, this 4-in-1 sheet provides a reference page, guided practice sorting statistical from non-statistical questions, applied problems, and a short exit ticket.",
  "8": "Understanding Distributions has 6th grade students describe a data set by its center, spread, and overall shape. Aligned to CCSS 6.SP.A.2, the sheet combines a reference page with worked examples, sequenced practice reading distributions, real-world application, and an assessment, keeping the full statistics lesson together on one sheet.",
  "9": "The Coordinate Plane for 6th grade teaches students to graph points in all four quadrants and explain how the signs of the coordinates locate each point. Aligned to CCSS 6.NS.C.6b, this skill sheet pairs a reference page with guided practice plotting and naming points, applied problems, and a built-in exit ticket.",
  "10": "Center vs Variability helps 6th graders explain the difference between a measure of center and a measure of variation and when each describes a data set best. Aligned to CCSS 6.SP.A.3, the sheet runs from a reference page through guided practice and application to a short assessment with a complete answer key.",
  "11": "Dividing Fractions by Fractions gives 6th grade students a reliable method for dividing fractions and interpreting the quotient in context. Aligned to CCSS 6.NS.A.1, this 4-in-1 sheet builds from a reference page with visual models through sixteen practice problems and real-world word problems to a built-in exit ticket.",
  "12": "Multi-Digit Operations covers fluent division of multi-digit whole numbers and computation with multi-digit decimals for 6th grade. Aligned to CCSS 6.NS.B.2 and 6.NS.B.3, the sheet pairs a reference page with the standard algorithms, sequenced practice, applied decimal problems, and an assessment, all on one printable.",
  "13": "Positive and Negative Numbers in Context teaches 6th graders to use signed numbers to represent real-world quantities such as temperature, elevation, and account balances. Aligned to CCSS 6.NS.C.5 and 6.NS.C.6a, this skill sheet moves from a reference page through guided practice and application to a short exit ticket.",
  "14": "Rationals on the Number Line and Coordinate Plane has 6th grade students plot rational numbers on a number line and in the coordinate plane. Aligned to CCSS 6.NS.C.6c, the sheet provides a reference page, guided practice placing and reading values, real-world application, and a built-in assessment with an answer key.",
  "15": "Comparing and Ordering Rationals and Absolute Value teaches 6th graders to compare and order rational numbers and interpret absolute value as distance from zero. Aligned to CCSS 6.NS.C.7, this 4-in-1 sheet carries the skill from a reference page through sequenced practice and application to a quick exit ticket.",
  "16": "Exponents for 6th grade teaches students to write and evaluate numerical expressions involving whole-number exponents. Aligned to CCSS 6.EE.A.1, the sheet pairs a reference page that distinguishes a base from an exponent with guided practice, sixteen problems, real-world application, and a built-in assessment, keeping the full lesson on one printable.",
  "17": "Writing Algebraic Expressions helps 6th graders translate words into algebraic expressions using variables and operations. Aligned to CCSS 6.EE.A.2a, this skill sheet moves from a reference page of common phrase-to-symbol translations through guided practice and applied problems to a short exit ticket with a complete answer key.",
  "18": "Evaluating Expressions teaches 6th grade students to evaluate algebraic expressions at specific values of their variables, including expressions drawn from real situations. Aligned to CCSS 6.EE.A.2c, the sheet pairs a reference page with worked substitutions, sequenced practice, real-world application, and a built-in assessment.",
  "19": "Combining Like Terms is a free 6th grade skill sheet that teaches students to identify like terms and combine them to write equivalent expressions. Aligned to CCSS 6.EE.A.3 and 6.EE.A.4, it is the complete 4-in-1 deliverable at no cost: a reference page, guided practice, real-world application, and a built-in exit ticket with answer key.",
  "20": "Distributive Property for 6th grade teaches students to apply the distributive property to write equivalent expressions. Aligned to CCSS 6.EE.A.3, this skill sheet builds from a reference page with worked examples through sixteen sequenced practice problems and real-world application to a short assessment, all on one printable.",
  "21": "Solving One-Step Equations gives 6th grade students a clear method for solving one-step equations using inverse operations. Aligned to CCSS 6.EE.B.7, the sheet pairs a reference page with guided notes, sequenced practice across addition, subtraction, multiplication, and division equations, applied word problems, and a built-in exit ticket.",
  "22": "Real-World Problems on the Coordinate Plane has 6th graders solve problems by graphing points and finding distances between them. Aligned to CCSS 6.NS.C.8, this 4-in-1 sheet moves from a reference page through guided practice plotting and measuring to real-world application and a short assessment with a full answer key.",
  "23": "Independent vs Dependent Variables teaches 6th grade students to identify the independent and dependent variables in a relationship and show how they relate using tables, graphs, and equations. Aligned to CCSS 6.EE.C.9, the sheet provides a reference page, guided practice, applied problems, and a built-in exit ticket.",
  "24": "Identifying Equivalent Expressions teaches 6th graders to recognize when two expressions are equivalent for every value of the variable. Aligned to CCSS 6.EE.A.4, this skill sheet pairs a reference page with guided practice testing equivalence, sequenced problems, real-world application, and a built-in assessment with an answer key.",
  "25": "Solutions to Equations and Writing Variables helps 6th grade students decide whether a value is a solution to an equation and use variables to represent unknown numbers. Aligned to CCSS 6.EE.B.5 and 6.EE.B.6, the sheet runs from a reference page through guided practice and application to a short exit ticket.",
  "26": "Inequalities and Their Graphs teaches 6th graders to write an inequality for a real-world condition and graph its solutions on a number line. Aligned to CCSS 6.EE.B.8, this 4-in-1 sheet carries the skill from a reference page through sequenced practice and applied problems to a built-in assessment with a complete answer key.",
  "27": "Quadrilaterals on the Coordinate Plane has 6th grade students draw quadrilaterals from given coordinates and use the coordinates to find side lengths. Aligned to CCSS 6.G.A.3, the sheet pairs a reference page with guided practice plotting and measuring, real-world application, and a built-in exit ticket.",
  "28": "Polygons on the Coordinate Plane teaches 6th graders to draw polygons from given vertices and use coordinates to find side lengths. Aligned to CCSS 6.G.A.3, this skill sheet builds from a reference page through guided practice and application to a short assessment, giving you the full coordinate-geometry lesson on one printable.",
  "29": "Data Displays covers dot plots, histograms, and box plots for 6th grade, teaching students to display numerical data in each form. Aligned to CCSS 6.SP.B.4, the sheet pairs a reference page comparing the three displays with guided practice, applied problems, and a built-in exit ticket with an answer key.",
  "30": "Numerical Data Summaries teaches 6th grade students to find the mean, median, and mode of a data set and choose the measure that best fits the situation. Aligned to CCSS 6.SP.B.5, this 4-in-1 sheet moves from a reference page through sequenced practice and real-world application to a short assessment.",
  "31": "Area of Polygons has 6th graders find the area of triangles and quadrilaterals by composing and decomposing them into known shapes. Aligned to CCSS 6.G.A.1, the sheet provides a reference page with the key formulas, guided practice, real-world application, and a built-in exit ticket with a complete answer key.",
  "32": "Volume with Fractional Edge Lengths teaches 6th grade students to find the volume of right rectangular prisms with fractional edge lengths. Aligned to CCSS 6.G.A.2, this skill sheet pairs a reference page with the volume formula and worked examples, sequenced practice, applied problems, and a built-in assessment.",
  "33": "Adding Integers gives 7th grade students a dependable method for adding positive and negative integers using absolute value, sign rules, and a number line. Aligned to CCSS 7.NS.A.1b, this 4-in-1 sheet pairs a reference page with guided notes, sixteen sequenced practice problems, real-world application, and a built-in exit ticket with a full answer key.",
  "34": "Subtracting Integers teaches 7th graders to subtract integers by rewriting each difference as adding the opposite. Aligned to CCSS 7.NS.A.1c, the sheet moves from a reference page that connects subtraction to distance on a number line through guided practice and applied problems to a short assessment, all on one printable.",
  "35": "Multiplying Integers helps 7th grade students multiply positive and negative integers using the rules for signs and understand why those rules work. Aligned to CCSS 7.NS.A.2a, this skill sheet builds from a reference page through sequenced practice and real-world application to a built-in exit ticket with an answer key.",
  "36": "Dividing Integers teaches 7th graders to divide integers and recognize when a quotient is positive or negative. Aligned to CCSS 7.NS.A.2b, the sheet pairs a reference page with the sign rules and worked examples, guided practice, applied problems, and a short assessment, keeping the full integer-division lesson together.",
  "37": "Adding and Subtracting Rationals extends signed-number operations to all rational numbers for 7th grade, including fractions and decimals in real-world contexts. Aligned to CCSS 7.NS.A.1d, this 4-in-1 sheet provides a reference page, guided practice, sixteen sequenced problems, application, and a built-in exit ticket with a complete answer key.",
  "38": "Multiplying and Dividing Rationals teaches 7th grade students to multiply and divide rational numbers, including fractions and decimals, with correct signs. Aligned to CCSS 7.NS.A.2c, the sheet runs from a reference page through guided practice and real-world application to a short assessment, giving you a full lesson on one printable.",
  "39": "Unit Rates for 7th grade teaches students to compute unit rates, including ratios of fractions, and use them to compare situations. Aligned to CCSS 7.RP.A.1, this skill sheet pairs a reference page with worked examples through guided practice, applied problems involving speeds and prices, and a built-in exit ticket with an answer key.",
  "40": "Constant of Proportionality helps 7th graders identify the constant of proportionality in tables, graphs, and equations and write equations in y = kx form. Aligned to CCSS 7.RP.A.2, the sheet builds from a reference page through sequenced practice and real-world application to a built-in assessment, all aligned and ready to teach.",
  "41": "Percent Problems for 7th grade covers percent of a number, percent increase, and percent decrease, the foundation for tax, tip, markup, and discount problems. Aligned to CCSS 7.RP.A.3, this 4-in-1 sheet pairs a reference page with guided practice, sixteen problems, real-world application, and a built-in exit ticket with a full answer key.",
  "42": "Scale Drawings teaches 7th grade students to solve problems with scale drawings, computing actual lengths and areas from a scaled figure. Aligned to CCSS 7.G.A.1, the sheet provides a reference page on scale factor, guided practice, applied problems, and a short assessment, keeping the full geometry lesson on one printable.",
  "43": "Angle Relationships for 7th grade teaches students to use complementary, supplementary, vertical, and adjacent angles to write and solve equations for unknown angles. Aligned to CCSS 7.G.B.5, this skill sheet pairs a reference page of labeled diagrams with guided practice, applied problems, and a built-in exit ticket with an answer key.",
  "44": "Triangle Inequality helps 7th graders decide whether three given side lengths can form a triangle and find the range of possible third sides. Aligned to CCSS 7.G.A.2, the sheet moves from a reference page through guided practice testing side-length sets to real-world application and a short assessment.",
  "45": "Two-Step Inequalities teaches 7th grade students to solve two-step inequalities, graph the solution set, and interpret it in context. Aligned to CCSS 7.EE.B.4b, this 4-in-1 sheet pairs a reference page with the sign-flip rule and worked examples, guided practice, applied problems, and a built-in exit ticket with answer key.",
  "46": "Rewriting Expressions teaches 7th graders to rewrite an expression in a different form to reveal how the quantities in a problem are related. Aligned to CCSS 7.EE.A.2, the sheet provides a reference page, guided practice, real-world application showing why a rewritten form is useful, and a short assessment with a complete answer key.",
  "47": "Multi-Step Rational Problems has 7th grade students solve multi-step problems with rational numbers in any form and check answers for reasonableness. Aligned to CCSS 7.EE.B.3, this skill sheet runs from a reference page through sequenced practice and applied word problems to a built-in exit ticket, all on one printable.",
  "48": "Combining Like Terms is a free 7th grade skill sheet that teaches students to combine like terms with rational coefficients to simplify expressions. Aligned to CCSS 7.EE.A.1, it is the complete 4-in-1 deliverable at no cost: a reference page, guided practice, real-world application, and a built-in exit ticket with a full answer key.",
  "49": "Distributive Property for 7th grade teaches students to expand and factor linear expressions using the distributive property. Aligned to CCSS 7.EE.A.1, this skill sheet pairs a reference page with worked examples in both directions, guided practice, sixteen sequenced problems, application, and a built-in assessment with an answer key.",
  "50": "Experimental and Theoretical Probability teaches 7th graders to compare experimental results with theoretical probability and explain why they differ. Aligned to CCSS 7.SP.C.6, this 4-in-1 sheet pairs a reference page with guided practice collecting and comparing data, applied problems, and a built-in exit ticket with a complete answer key.",
  "51": "Probability Models teaches 7th grade students to develop probability models and use them to find the probability of events. Aligned to CCSS 7.SP.C.7, the sheet moves from a reference page through guided practice building uniform and non-uniform models to real-world application and a short assessment.",
  "52": "Compound Events helps 7th graders find probabilities of compound events using organized lists, tables, and tree diagrams. Aligned to CCSS 7.SP.C.8, this skill sheet pairs a reference page with worked sample spaces, guided practice, applied problems, and a built-in exit ticket with an answer key, all on one printable.",
  "53": "Additive Inverse and Opposites teaches 7th grade students to describe opposite quantities and recognize that a number and its opposite sum to zero. Aligned to CCSS 7.NS.A.1a, the sheet provides a reference page, guided practice on a number line, real-world application, and a built-in exit ticket with a complete answer key.",
  "54": "Terminating vs Repeating Decimals teaches 7th graders to convert between fractions, decimals, and percents, including recognizing repeating decimals. Aligned to CCSS 7.NS.A.2d, this 4-in-1 sheet pairs a reference page with the long-division method, guided practice, applied problems, and a built-in assessment with an answer key.",
  "55": "Real-World Rational Number Problems has 7th grade students solve real situations using the four operations with rational numbers. Aligned to CCSS 7.NS.A.3, the sheet runs from a reference page through guided practice and multi-context word problems to a short exit ticket, keeping the full lesson on one printable.",
  "56": "Probability Scale 0 to 1 teaches 7th graders to describe the probability of an event with a number from 0 to 1 and place events on a likelihood scale. Aligned to CCSS 7.SP.C.5, this skill sheet pairs a reference page with guided practice, applied problems, and a built-in exit ticket with a complete answer key.",
  "57": "Random Sampling teaches 7th grade students to use random samples to draw inferences about a population and understand why a sample must be representative. Aligned to CCSS 7.SP.A.1, the sheet provides a reference page, guided practice, applied problems, and a built-in assessment, all aligned and classroom-ready.",
  "58": "Inferences from Random Samples has 7th graders use data from a random sample to draw inferences about a whole population and gauge how estimates vary. Aligned to CCSS 7.SP.A.2, this 4-in-1 sheet moves from a reference page through guided practice and real-world application to a short exit ticket with an answer key.",
  "59": "Comparing Populations Informally teaches 7th grade students to compare two populations using measures of center and variability and the visual overlap of their distributions. Aligned to CCSS 7.SP.B.3, the sheet pairs a reference page with guided practice, applied problems, and a built-in exit ticket with a complete answer key.",
  "60": "Comparing Populations Numerically teaches 7th graders to compare two populations using measures of center and variability expressed numerically. Aligned to CCSS 7.SP.B.4, this skill sheet runs from a reference page through sequenced practice and real-world application to a short assessment, giving you a full lesson on one printable.",
  "61": "Circumference and Area of Circles teaches 7th grade students to use the formulas for the circumference and area of a circle and understand how they relate. Aligned to CCSS 7.G.B.4, this 4-in-1 sheet pairs a reference page with labeled diagrams, guided practice, applied problems, and a built-in exit ticket with an answer key.",
  "62": "Cross-Sections of 3D Figures teaches 7th graders to describe the two-dimensional cross sections that result from slicing three-dimensional figures. Aligned to CCSS 7.G.A.3, the sheet provides a reference page with visual examples, guided practice, applied problems, and a built-in assessment, all on one printable.",
  "63": "Composite Area, Volume, and Surface Area has 7th grade students solve area and volume problems with composite two- and three-dimensional figures. Aligned to CCSS 7.G.B.6, this skill sheet pairs a reference page with a decomposition strategy, guided practice, applied problems, and a built-in exit ticket with a complete answer key.",
  "64": "Identifying Parts of an Expression teaches 6th graders the vocabulary of algebra: terms, factors, coefficients, sums, and products. Aligned to CCSS 6.EE.A.2b, this 4-in-1 sheet pairs a reference page of labeled examples with guided practice naming the parts of an expression, applied problems, and a built-in exit ticket with answer key.",
  "65": "Equations with Rational Coefficients teaches 8th grade students to solve linear equations whose coefficients are fractions or decimals. Aligned to CCSS 8.EE.C.7b, this 4-in-1 sheet pairs a reference page with strategies for clearing fractions, guided practice, sixteen sequenced problems, application, and a built-in exit ticket with a full answer key.",
  "66": "Writing and Solving Equations from Word Problems teaches 8th graders to translate a real situation into a linear equation and solve it. Aligned to CCSS 8.EE.C.7b, the sheet moves from a reference page through guided practice setting up equations to applied word problems and a short assessment, all on one printable.",
  "67": "Two-Step Equations teaches 7th grade students to solve two-step equations and justify each step with the properties of operations. Aligned to CCSS 7.EE.B.4a, the sheet builds from a reference page with worked examples through guided practice, sixteen sequenced problems, application, and a built-in exit ticket with an answer key.",
  "68": "Rational vs Irrational Numbers teaches 8th grade students to classify numbers as rational or irrational and estimate the value of an irrational number. Aligned to CCSS 8.NS.A.1, this skill sheet pairs a reference page with examples and decimal expansions, guided practice, applied problems, and a built-in exit ticket with an answer key.",
  "69": "Two-Way Tables teaches 8th graders to construct and interpret two-way tables and use relative frequencies to find patterns in categorical data. Aligned to CCSS 8.SP.A.4, the sheet provides a reference page, guided practice reading and building tables, real-world application, and a built-in assessment with a complete answer key.",
  "70": "Scientific Notation Conversion teaches 8th grade students to convert between standard form and scientific notation and use it to express very large and very small numbers. Aligned to CCSS 8.EE.A.3, this 4-in-1 sheet pairs a reference page with worked conversions, guided practice, applied problems, and a built-in exit ticket with an answer key.",
  "71": "Exponent Rules teaches 8th graders to apply the properties of integer exponents to simplify expressions, including the product, quotient, and power rules. Aligned to CCSS 8.EE.A.1, the sheet runs from a reference page through guided practice and sixteen sequenced problems to a short assessment, keeping the full lesson on one printable.",
  "72": "Negative and Zero Exponents teaches 8th grade students to apply the properties of integer exponents to generate equivalent expressions, including negative and zero exponents. Aligned to CCSS 8.EE.A.1, this skill sheet pairs a reference page with worked examples, guided practice, applied problems, and a built-in exit ticket with a full answer key.",
  "73": "Functions Definition teaches 8th graders that a function assigns exactly one output to each input, and how to test relationships for this rule. Aligned to CCSS 8.F.A.1, the sheet provides a reference page with the vertical-line test and mapping diagrams, guided practice, application, and a built-in assessment with an answer key.",
  "74": "Operations with Scientific Notation teaches 8th grade students to add, subtract, multiply, and divide numbers written in scientific notation. Aligned to CCSS 8.EE.A.4, this 4-in-1 sheet pairs a reference page with worked examples, guided practice, applied problems with appropriate units, and a built-in exit ticket with a complete answer key.",
  "75": "Multi-Step Equations teaches 8th graders to solve linear equations that require distributing and combining like terms, then to check the solution. Aligned to CCSS 8.EE.C.7b, the sheet moves from a reference page through guided practice and sixteen sequenced problems to a short assessment, all on one printable.",
  "76": "One, None, or Infinite Solutions teaches 8th grade students to decide whether a linear equation has one solution, no solution, or infinitely many. Aligned to CCSS 8.EE.C.7a, this skill sheet pairs a reference page with worked examples of each case, guided practice, applied problems, and a built-in exit ticket with an answer key.",
  "77": "Slope-Intercept Form teaches 8th graders to use similar triangles to explain slope and write linear equations in y = mx + b form. Aligned to CCSS 8.EE.B.6, the sheet provides a reference page connecting slope to rate of change, guided practice, application, and a built-in assessment with a complete answer key.",
  "78": "Graphing Linear Equations teaches 8th grade students to identify whether a function is linear or nonlinear from its equation or graph and graph linear functions. Aligned to CCSS 8.F.A.3, this 4-in-1 sheet pairs a reference page with guided practice, applied problems, and a built-in exit ticket with a full answer key.",
  "79": "Proportional Relationships teaches 8th graders to graph proportional relationships and interpret the unit rate as the slope of the line. Aligned to CCSS 8.EE.B.5, the sheet runs from a reference page through guided practice comparing relationships in different forms to applied problems and a short assessment.",
  "80": "Systems by Graphing teaches 8th grade students to solve a system of two linear equations by graphing and interpret the point of intersection. Aligned to CCSS 8.EE.C.8a, this skill sheet pairs a reference page with worked examples, guided practice, applied problems, and a built-in exit ticket with an answer key, all on one printable.",
  "81": "Square and Cube Roots teaches 8th graders to evaluate square roots and cube roots and use them to solve simple equations of the form x squared equals p and x cubed equals p. Aligned to CCSS 8.EE.A.2, the sheet provides a reference page, guided practice, application, and a built-in assessment with a complete answer key.",
  "82": "Systems by Substitution teaches 8th grade students to solve a system of linear equations using the substitution method. Aligned to CCSS 8.EE.C.8 and 8.EE.C.8b, this 4-in-1 sheet pairs a reference page with a step-by-step worked example, guided practice, sixteen problems, application, and a built-in exit ticket with a full answer key.",
  "83": "Systems by Elimination teaches 8th graders to solve a system of linear equations using the elimination method. Aligned to CCSS 8.EE.C.8 and 8.EE.C.8b, the sheet moves from a reference page through guided practice and sequenced problems to applied word problems and a short assessment, all on one printable.",
  "84": "Approximating Irrationals teaches 8th grade students to approximate irrational numbers with rational values and locate them on a number line. Aligned to CCSS 8.NS.A.2, this skill sheet pairs a reference page with an estimation strategy, guided practice, applied problems, and a built-in exit ticket with an answer key.",
  "85": "Comparing Functions teaches 8th graders to compare two functions represented in different ways, such as a table, graph, equation, or description. Aligned to CCSS 8.F.A.2, the sheet provides a reference page, guided practice translating between representations, application, and a built-in assessment with a complete answer key.",
  "86": "Constructing Linear Functions teaches 8th grade students to construct a linear function from a relationship and interpret its rate of change and initial value. Aligned to CCSS 8.F.B.4, this 4-in-1 sheet pairs a reference page with worked examples, guided practice, applied problems, and a built-in exit ticket with a full answer key.",
  "87": "Qualitative Graph Features teaches 8th graders to sketch and describe a graph that models the relationship between two quantities, including increasing, decreasing, and constant intervals. Aligned to CCSS 8.F.B.5, the sheet runs from a reference page through guided practice and application to a short assessment, all on one printable.",
  "88": "Converse of the Pythagorean Theorem teaches 8th grade students to use the converse to decide whether a triangle is a right triangle from its side lengths. Aligned to CCSS 8.G.B.6, this skill sheet pairs a reference page with worked examples, guided practice, applied problems, and a built-in exit ticket with an answer key.",
  "89": "Translations teaches 8th graders to perform translations on the coordinate plane and describe their effect on a figure using coordinates. Aligned to CCSS 8.G.A.1, the sheet provides a reference page, guided practice sliding figures, application, and a built-in assessment with a complete answer key.",
  "90": "Reflections teaches 8th grade students to reflect figures across lines on the coordinate plane and describe the result using coordinates. Aligned to CCSS 8.G.A.2, this 4-in-1 sheet pairs a reference page with worked examples across the axes and other lines, guided practice, application, and a built-in exit ticket with an answer key.",
  "91": "Rotations teaches 8th graders to rotate figures about a point and describe the effect on the coordinates. Aligned to CCSS 8.G.A.3, the sheet moves from a reference page through guided practice with common rotation angles to applied problems and a short assessment, keeping the full lesson on one printable.",
  "92": "Dilations teaches 8th grade students to perform dilations and describe how they change a figure's size while preserving its shape. Aligned to CCSS 8.G.A.4, this skill sheet pairs a reference page with scale-factor examples, guided practice, applied problems, and a built-in exit ticket with a complete answer key.",
  "93": "Congruence through Transformations teaches 8th graders to use sequences of rigid motions to decide whether two figures are congruent. Aligned to CCSS 8.G.A.2, the sheet provides a reference page, guided practice describing transformation sequences, application, and a built-in assessment with an answer key.",
  "94": "Similarity through Transformations teaches 8th grade students to use dilations and rigid motions to show that two figures are similar. Aligned to CCSS 8.G.A.4, this 4-in-1 sheet pairs a reference page with worked examples, guided practice, applied problems, and a built-in exit ticket with a full answer key.",
  "95": "Angle Relationships with Parallel Lines teaches 8th graders to find angle measures created when parallel lines are cut by a transversal. Aligned to CCSS 8.G.A.5, the sheet runs from a reference page of labeled angle pairs through guided practice and application to a short assessment, all on one printable.",
  "96": "The Pythagorean Theorem teaches 8th grade students to use the theorem to find unknown side lengths in right triangles in real-world and mathematical problems. Aligned to CCSS 8.G.B.7, this skill sheet pairs a reference page with worked examples, guided practice, applied problems, and a built-in exit ticket with a complete answer key.",
  "97": "Distance on the Coordinate Plane teaches 8th graders to use the Pythagorean Theorem to find the distance between two points. Aligned to CCSS 8.G.B.8, the sheet provides a reference page connecting the distance to a right triangle, guided practice, application, and a built-in assessment with an answer key.",
  "98": "Volume of Cones, Cylinders, and Spheres teaches 8th grade students to use the volume formulas for each solid to solve problems. Aligned to CCSS 8.G.C.9, this 4-in-1 sheet pairs a reference page with labeled formulas, guided practice, applied problems, and a built-in exit ticket with a full answer key.",
  "99": "Scatter Plots teaches 8th graders to construct and interpret scatter plots and describe patterns of association such as clustering, outliers, and direction. Aligned to CCSS 8.SP.A.1, the sheet runs from a reference page through guided practice and application to a short assessment, all on one printable.",
  "100": "Lines of Best Fit teaches 8th grade students to fit a line to data and use its slope and intercept to make predictions. Aligned to CCSS 8.SP.A.2, this skill sheet pairs a reference page with worked examples, guided practice drawing and using a trend line, applied problems, and a built-in exit ticket with an answer key.",
  "101": "Nets and Surface Area teaches 6th grade students to use nets of three-dimensional figures to find surface area. Aligned to CCSS 6.G.A.4, the sheet provides a reference page with unfolded solids, guided practice, applied problems, and a built-in assessment with a complete answer key, keeping the full lesson on one printable.",
  "102": "Scatter Plot Slope and Intercept teaches 8th graders to interpret the slope and intercept of a line that models scatter-plot data in context. Aligned to CCSS 8.SP.A.3, this 4-in-1 sheet pairs a reference page with worked interpretations, guided practice, applied problems, and a built-in exit ticket with a full answer key.",
  "103": "Systems Word Problems teaches 8th grade students to write and solve a system of two linear equations from a real-world situation. Aligned to CCSS 8.EE.C.8c, the sheet moves from a reference page through guided practice setting up systems to applied word problems and a short assessment, all on one printable."
};

/* ----- Bundle catalog (authored S3): live TPT URLs + membership + SEO blurbs ----- */
const BUNDLES = [
  { "id":"16734500","grade":"6","tier":"strand","name":"6th Grade Ratios & Proportional Relationships","slug":"6th-grade-ratios-proportional-relationships","url":"https://www.teacherspayteachers.com/Product/Ratios-Proportional-Relationships-Bundle-6th-Grade-Math-Unit-Rate-Ratios-16734500","thumb":"thumb1_hero_6th_RatiosProportional.png","sheets":[4,5,6],
    "blurb":"The full 6th grade Ratios and Proportional Relationships strand in one place, aligned to 6.RP. Students build ratio language, unit rates, and ratio reasoning with tables, tape diagrams, and percents. Each of the three skills is a complete 4-in-1 Skill Sheet with reference, practice, application, and a built-in assessment." },

  { "id":"16734427","grade":"6","tier":"strand","name":"6th Grade The Number System","slug":"6th-grade-number-system","url":"https://www.teacherspayteachers.com/Product/6th-Grade-Number-System-Bundle-GCF-LCM-Dividing-Fractions-Decimals-16734427","thumb":"thumb1_hero_6th_NumberSystem.png","sheets":[2,3,11,12],
    "blurb":"Greatest common factor, least common multiple, dividing fractions, and multi-digit decimal operations, aligned to 6.NS. This 6th grade Number System bundle gives you four 4-in-1 Skill Sheets that each move from a color reference page through guided practice and real-world application to a built-in exit ticket." },

  { "id":"16734459","grade":"6","tier":"strand","name":"6th Grade Rational Numbers","slug":"6th-grade-rational-numbers","url":"https://www.teacherspayteachers.com/Product/6th-Grade-Rational-Numbers-Bundle-Negative-Numbers-Absolute-Value-6NS-16734459","thumb":"thumb1_hero_6th_RationalNumbers.png","sheets":[13,14,15],
    "blurb":"Negative numbers, the number line and coordinate plane, ordering, and absolute value, aligned to 6.NS.C. These three 4-in-1 Skill Sheets introduce signed numbers in real contexts and build to comparing and ordering rationals, each with a reference page, scaffolded practice, application, and an assessment." },

  { "id":"16737021","grade":"6","tier":"topic","name":"6th Grade Coordinate Plane","slug":"6th-grade-coordinate-plane","url":"https://www.teacherspayteachers.com/Product/6th-Grade-Coordinate-Plane-Bundle-Four-Quadrants-Plotting-Points-Polygons-16737021","thumb":"thumb1_hero_6th_CoordinatePlane.png","sheets":[9,22,27,28],
    "blurb":"A focused 6th grade coordinate plane bundle covering all four quadrants, plotting and reading points, real-world problems, and drawing polygons and quadrilaterals from coordinates. Four 4-in-1 Skill Sheets aligned to 6.NS.C and 6.G.A, each with a reference page, practice, application, and a built-in exit ticket." },

  { "id":"16734737","grade":"6","tier":"strand","name":"6th Grade Geometry","slug":"6th-grade-geometry","url":"https://www.teacherspayteachers.com/Product/6th-Grade-Geometry-Bundle-Area-Volume-Nets-Surface-Area-6G-Math-16734737","thumb":"thumb1_hero_6th_Geometry.png","sheets":[31,32,101],
    "blurb":"Area of polygons, volume with fractional edge lengths, and surface area from nets, aligned to 6.G. This 6th grade Geometry bundle delivers three 4-in-1 Skill Sheets that pair clear formula references with guided practice, real-world application, and a built-in assessment on each printable." },

  { "id":"16734699","grade":"6","tier":"strand","name":"6th Grade Statistics & Probability","slug":"6th-grade-statistics-probability","url":"https://www.teacherspayteachers.com/Product/6th-Grade-Statistics-Data-Bundle-Dot-Plots-Histograms-Box-Plots-Mean-Median-16734699","thumb":"thumb1_hero_6th_StatisticsProbability.png","sheets":[7,8,10,29,30],
    "blurb":"The complete 6th grade Statistics and Probability strand, aligned to 6.SP. Students learn statistical questions, distributions, center versus variability, data displays, and numerical summaries across five 4-in-1 Skill Sheets, each with a reference page, practice, real-world application, and a built-in exit ticket." },

  { "id":"16737025","grade":"6","tier":"topic","name":"6th Grade Expressions","slug":"6th-grade-expressions","url":"https://www.teacherspayteachers.com/Product/6th-Grade-Expressions-Bundle-Order-of-Operations-Exponents-Evaluating-16737025","thumb":"thumb1_hero_6th_Expressions.png","sheets":[1,16,17,64,18,19,20,24],
    "blurb":"The expressions half of 6.EE: order of operations, exponents, writing and evaluating expressions, parts of an expression, combining like terms, the distributive property, and equivalent expressions. Eight 4-in-1 Skill Sheets, including the free Combining Like Terms sheet, each with reference, practice, application, and assessment." },

  { "id":"16737026","grade":"6","tier":"topic","name":"6th Grade Equations & Inequalities","slug":"6th-grade-equations-inequalities","url":"https://www.teacherspayteachers.com/Product/6th-Grade-Equations-Inequalities-Bundle-One-Step-Equations-Graphs-6EE-16737026","thumb":"thumb1_hero_6th_EquationsInequalities.png","sheets":[21,25,26,23],
    "blurb":"The equations half of 6.EE: solving one-step equations, identifying solutions and writing variable expressions, inequalities and their graphs, and independent versus dependent variables. Four 4-in-1 Skill Sheets aligned to 6.EE.B and 6.EE.C, each with a reference page, scaffolded practice, application, and a built-in assessment." },

  { "id":"16734544","grade":"6","tier":"strand","name":"6th Grade Expressions & Equations","slug":"6th-grade-expressions-equations","url":"https://www.teacherspayteachers.com/Product/6th-Grade-Expressions-Equations-Bundle-Exponents-Equations-Inequalities-6EE-16734544","thumb":"thumb1_hero_6th_ExpressionsEquations.png","sheets":[1,16,17,18,19,20,21,23,24,25,26,64],
    "blurb":"The entire 6.EE strand in one bundle: exponents, writing and evaluating expressions, combining like terms, the distributive property, equivalent expressions, one-step equations, inequalities, and dependent and independent variables. Twelve 4-in-1 Skill Sheets, each carrying a reference page, practice, real-world application, and a built-in exit ticket." },

  { "id":"16464069","grade":"6","tier":"mega","name":"6th Grade Math MEGA Bundle","slug":"6th-grade-math-mega-bundle","url":"https://www.teacherspayteachers.com/Product/6th-Grade-Math-MEGA-Bundle-4-in-1-Skill-Sheets-Full-Year-Common-Core-34-Skills-16464069","thumb":"6th Grade Full Skill Sheets Bundle Hero.png","sheets":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,64,101],
    "blurb":"Every 6th grade 4-in-1 Skill Sheet for the full year, all 34 skills across ratios and proportional relationships, the number system, expressions and equations, geometry, and statistics. A complete Common Core aligned 6th grade math curriculum of reference pages, practice, application, and built-in assessments in one bundle." },

  { "id":"16694244","grade":"7","tier":"topic","name":"7th Grade Integer Operations","slug":"7th-grade-integer-operations","url":"https://www.teacherspayteachers.com/Product/Integer-Operations-Bundle-Adding-Subtracting-Multiplying-Dividing-7th-Grade-16694244","thumb":"thumb1_hero_7th_IntegerOps_strand.png","sheets":[33,34,35,36],
    "blurb":"Adding, subtracting, multiplying, and dividing integers, aligned to 7.NS.A. This focused 7th grade integer operations bundle gives you four 4-in-1 Skill Sheets that teach the sign rules with number lines and worked examples, each with a reference page, sequenced practice, application, and a built-in exit ticket." },

  { "id":"16694295","grade":"7","tier":"topic","name":"7th Grade Rational Number Operations","slug":"7th-grade-rational-number-operations","url":"https://www.teacherspayteachers.com/Product/Operations-with-Rational-Numbers-Bundle-7th-Grade-Math-Worksheets-Notes-16694295","thumb":"thumb1_hero_7th_RationalOps_strand.png","sheets":[37,38,53,54,55],
    "blurb":"Operations with rational numbers for 7th grade, aligned to 7.NS.A: adding and subtracting rationals, multiplying and dividing rationals, additive inverse and opposites, terminating and repeating decimals, and real-world rational number problems. Five 4-in-1 Skill Sheets, each with a reference page, practice, application, and an assessment." },

  { "id":"16694333","grade":"7","tier":"strand","name":"7th Grade The Number System","slug":"7th-grade-number-system","url":"https://www.teacherspayteachers.com/Product/7th-Grade-Number-System-Bundle-Integers-Rational-Numbers-7NS-Worksheets-16694333","thumb":"thumb1_hero_7th_NumberSystem_strand.png","sheets":[33,34,35,36,37,38,53,54,55],
    "blurb":"The complete 7.NS strand: integer operations, rational number operations, additive inverse, decimal conversions, and real-world problems. Nine 4-in-1 Skill Sheets that take students from signed-number rules through fluent operations with all rational numbers, each with reference, practice, application, and a built-in assessment." },

  { "id":"16694375","grade":"7","tier":"strand","name":"7th Grade Ratios & Proportional Relationships","slug":"7th-grade-ratios-proportional-relationships","url":"https://www.teacherspayteachers.com/Product/Ratios-Proportional-Relationships-Bundle-7th-Grade-Math-Unit-Rate-Percent-16694375","thumb":"thumb1_hero_7th_RatiosProportional_strand.png","sheets":[39,40,41],
    "blurb":"Unit rates, the constant of proportionality, and percent problems, aligned to 7.RP. This 7th grade proportional relationships bundle delivers three 4-in-1 Skill Sheets covering the reasoning behind tax, tip, markup, and percent change, each with a reference page, practice, application, and a built-in exit ticket." },

  { "id":"16694397","grade":"7","tier":"strand","name":"7th Grade Geometry","slug":"7th-grade-geometry","url":"https://www.teacherspayteachers.com/Product/7th-Grade-Geometry-Bundle-Circles-Angles-Scale-Drawings-Surface-Area-Volume-16694397","thumb":"thumb1_hero_7th_Geometry_strand.png","sheets":[42,43,44,61,62,63],
    "blurb":"Scale drawings, angle relationships, triangle inequality, circles, cross sections, and composite area, volume, and surface area, aligned to 7.G. Six 4-in-1 Skill Sheets that build the full 7th grade geometry strand, each with a reference page, scaffolded practice, real-world application, and a built-in assessment." },

  { "id":"16694417","grade":"7","tier":"strand","name":"7th Grade Expressions & Equations","slug":"7th-grade-expressions-equations","url":"https://www.teacherspayteachers.com/Product/7th-Grade-Expressions-Equations-Bundle-Two-Step-Equations-Inequalities-16694417","thumb":"thumb1_hero_7th_ExpressionsEquations_strand.png","sheets":[45,46,47,48,49,67],
    "blurb":"Two-step equations and inequalities, combining like terms, the distributive property, rewriting expressions, and multi-step rational problems, aligned to 7.EE. Six 4-in-1 Skill Sheets, including the free Combining Like Terms sheet, each with a reference page, practice, real-world application, and a built-in exit ticket." },

  { "id":"16694443","grade":"7","tier":"strand","name":"7th Grade Statistics & Probability","slug":"7th-grade-statistics-probability","url":"https://www.teacherspayteachers.com/Product/7th-Grade-Statistics-Probability-Bundle-Probability-Sampling-Worksheets-16694443","thumb":"thumb1_hero_7th_StatisticsProbability_strand.png","sheets":[50,51,52,56,57,58,59,60],
    "blurb":"The full 7.SP strand: experimental and theoretical probability, probability models, compound events, the probability scale, random sampling, inferences, and comparing populations. Eight 4-in-1 Skill Sheets covering probability and inference, each with a reference page, practice, application, and a built-in assessment." },

  { "id":"16465247","grade":"7","tier":"mega","name":"7th Grade Math MEGA Bundle","slug":"7th-grade-math-mega-bundle","url":"https://www.teacherspayteachers.com/Product/7th-Grade-Math-MEGA-Bundle-4-in-1-Skill-Sheets-Full-Year-32-Skills-CCSS-16465247","thumb":"7th Grade Full Skill Sheets Bundle Hero.png","sheets":[33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,67],
    "blurb":"Every 7th grade 4-in-1 Skill Sheet for the full year, all 32 skills across the number system, ratios and proportional relationships, expressions and equations, geometry, and statistics and probability. A complete Common Core aligned 7th grade math curriculum of reference pages, practice, application, and assessments." },

  { "id":"16735842","grade":"8","tier":"topic","name":"8th Grade Exponents & Scientific Notation","slug":"8th-grade-exponents-scientific-notation","url":"https://www.teacherspayteachers.com/Product/Exponent-Rules-Scientific-Notation-Bundle-8th-Grade-Math-Laws-of-Exponents-16735842","thumb":"thumb1_hero_8th_ExponentsSciNotation.png","sheets":[70,71,72,74],
    "blurb":"The laws of exponents and scientific notation, aligned to 8.EE.A: exponent rules, negative and zero exponents, scientific notation conversion, and operations in scientific notation. Four 4-in-1 Skill Sheets, each moving from a reference page through sequenced practice and real-world application to a built-in exit ticket." },

  { "id":"16735847","grade":"8","tier":"topic","name":"8th Grade Linear Equations & Slope","slug":"8th-grade-linear-equations-slope","url":"https://www.teacherspayteachers.com/Product/Linear-Equations-Slope-Bundle-8th-Grade-Math-Slope-Intercept-Form-16735847","thumb":"thumb1_hero_8th_LinearEquationsSlope.png","sheets":[65,66,75,76,77,79],
    "blurb":"Solving linear equations and understanding slope, aligned to 8.EE.B and 8.EE.C: equations with rational coefficients, word problems, multi-step equations, one-none-or-infinite solutions, slope-intercept form, and proportional relationships. Six 4-in-1 Skill Sheets, each with a reference page, practice, application, and a built-in assessment." },

  { "id":"16735850","grade":"8","tier":"topic","name":"8th Grade Systems of Equations","slug":"8th-grade-systems-of-equations","url":"https://www.teacherspayteachers.com/Product/Systems-of-Equations-Bundle-8th-Grade-Math-Substitution-Elimination-16735850","thumb":"thumb1_hero_8th_SystemsOfEquations.png","sheets":[80,82,83,103],
    "blurb":"Solving systems of linear equations, aligned to 8.EE.C.8: systems by graphing, substitution, and elimination, plus real-world systems word problems. Four 4-in-1 Skill Sheets that build from the meaning of a solution to fluent algebraic methods, each with a reference page, practice, application, and an assessment." },

  { "id":"16735852","grade":"8","tier":"strand","name":"8th Grade Expressions & Equations","slug":"8th-grade-expressions-equations","url":"https://www.teacherspayteachers.com/Product/8th-Grade-Expressions-Equations-Bundle-Exponents-Slope-Systems-8EE-16735852","thumb":"thumb1_hero_8th_ExpressionsEquations.png","sheets":[65,66,70,71,72,74,75,76,77,79,80,82,83,103],
    "blurb":"The entire 8.EE strand in one bundle: exponents and scientific notation, linear equations, slope, and systems of equations. Fourteen 4-in-1 Skill Sheets spanning every expressions-and-equations standard in 8th grade, each with a reference page, scaffolded practice, real-world application, and a built-in exit ticket." },

  { "id":"16735840","grade":"8","tier":"strand","name":"8th Grade Functions","slug":"8th-grade-functions","url":"https://www.teacherspayteachers.com/Product/8th-Grade-Functions-Bundle-Linear-Functions-Graphing-Comparing-8F-Math-16735840","thumb":"thumb1_hero_8th_Functions.png","sheets":[73,78,85,86,87],
    "blurb":"The full 8.F strand: defining functions, graphing linear functions, comparing functions across representations, constructing linear functions, and describing graphs qualitatively. Five 4-in-1 Skill Sheets that build function reasoning from tables, graphs, and equations, each with a reference page, practice, application, and a built-in assessment." },

  { "id":"16735833","grade":"8","tier":"strand","name":"8th Grade The Number System","slug":"8th-grade-number-system","url":"https://www.teacherspayteachers.com/Product/8th-Grade-Number-System-Bundle-Rational-Irrational-Numbers-Square-Roots-16735833","thumb":"thumb1_hero_8th_NumberSystem.png","sheets":[68,81,84],
    "blurb":"Rational and irrational numbers, square and cube roots, and approximating irrationals, aligned to 8.NS and 8.EE.A.2. This 8th grade Number System bundle delivers three 4-in-1 Skill Sheets that classify and estimate real numbers, each with a reference page, practice, application, and a built-in exit ticket." },

  { "id":"16735861","grade":"8","tier":"strand","name":"8th Grade Geometry","slug":"8th-grade-geometry","url":"https://www.teacherspayteachers.com/Product/8th-Grade-Geometry-Bundle-Transformations-Pythagorean-Theorem-Volume-8G-16735861","thumb":"thumb1_hero_8th_Geometry.png","sheets":[88,89,90,91,92,93,94,95,96,97,98],
    "blurb":"The complete 8.G strand: transformations, congruence and similarity, angle relationships, the Pythagorean Theorem and its converse, distance, and volume of cones, cylinders, and spheres. Eleven 4-in-1 Skill Sheets covering all of 8th grade geometry, each with reference, practice, application, and a built-in assessment." },

  { "id":"16735854","grade":"8","tier":"topic","name":"8th Grade Transformations & Congruence","slug":"8th-grade-transformations-congruence","url":"https://www.teacherspayteachers.com/Product/8th-Grade-Transformations-Bundle-Translations-Reflections-Rotations-Dilations-16735854","thumb":"thumb1_hero_8th_TransformationsCongruence.png","sheets":[89,90,91,92,93,94,95],
    "blurb":"Translations, reflections, rotations, dilations, congruence, similarity, and parallel lines cut by a transversal, aligned to 8.G.A. Seven 4-in-1 Skill Sheets that teach the coordinate effects of each transformation, each with a reference page, scaffolded practice, application, and a built-in exit ticket." },

  { "id":"16735858","grade":"8","tier":"topic","name":"8th Grade Pythagorean Theorem & Volume","slug":"8th-grade-pythagorean-theorem-volume","url":"https://www.teacherspayteachers.com/Product/Pythagorean-Theorem-Volume-Bundle-8th-Grade-Math-Distance-Cones-Cylinders-16735858","thumb":"thumb1_hero_8th_PythagoreanVolume.png","sheets":[88,96,97,98],
    "blurb":"The Pythagorean Theorem, its converse, distance on the coordinate plane, and the volume of cones, cylinders, and spheres, aligned to 8.G.B and 8.G.C. Four 4-in-1 Skill Sheets with clear diagrams and worked examples, each with a reference page, practice, application, and a built-in assessment." },

  { "id":"16735837","grade":"8","tier":"strand","name":"8th Grade Statistics & Probability","slug":"8th-grade-statistics-probability","url":"https://www.teacherspayteachers.com/Product/8th-Grade-Statistics-Bundle-Scatter-Plots-Line-of-Best-Fit-Two-Way-Tables-16735837","thumb":"thumb1_hero_8th_StatisticsProbability.png","sheets":[69,99,100,102],
    "blurb":"The full 8.SP strand: scatter plots, lines of best fit, interpreting slope and intercept, and two-way tables. Four 4-in-1 Skill Sheets that teach students to model and interpret bivariate data, each with a reference page, scaffolded practice, real-world application, and a built-in exit ticket." },

  { "id":"16515341","grade":"8","tier":"mega","name":"8th Grade Math MEGA Bundle","slug":"8th-grade-math-mega-bundle","url":"https://www.teacherspayteachers.com/Product/8th-Grade-Math-Worksheets-MEGA-Bundle-4-in-1-Skill-Sheets-37-Sheets-16515341","thumb":"8th Grade Full Skill Sheets Bundle Hero.png","sheets":[65,66,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,102,103],
    "blurb":"Every 8th grade 4-in-1 Skill Sheet for the full year, all 37 skills across the number system, expressions and equations, functions, geometry, and statistics and probability. A complete Common Core aligned 8th grade math curriculum of reference pages, practice, application, and built-in assessments in one bundle." },

  { "id":"16515388","grade":"all","tier":"ultimate","name":"Middle School Math ULTIMATE Bundle","slug":"middle-school-math-ultimate-bundle","url":"https://www.teacherspayteachers.com/Product/Middle-School-Math-ULTIMATE-Bundle-103-Skill-Sheets-Grades-6-8-16515388","thumb":"Ultimate 6-8th Skill Sheets thumb 1.png","sheets":[],
    "blurb":"Every 4-in-1 Skill Sheet for grades 6, 7, and 8 in a single bundle, all 103 skills covering the complete Common Core middle school math sequence. From 6th grade ratios to 8th grade functions and geometry, each skill is a full reference, practice, application, and assessment on one printable." }
];

const products = catalog.map(row => {
  const g = gradeNum(row.Grade);
  const ccss = cleanCCSS(row.CCSS);
  const strand = strandOf(row.CCSS);
  const live = /SHIPPED/i.test(row.Status);
  const free = /FREEBIE/i.test(row.Status) || /FREE/i.test(row.SkillName);
  // clean skill name: strip parenthetical FREE tags for display
  let name = row.SkillName.replace(/\s*\(\s*\d?(st|nd|rd|th)?\s*[—-]?\s*FREE\s*\)/i, '').replace(/\s*—\s*FREE/i, '').trim();
  let ican = icanByUrl[row.TPT_URL] || '';
  if (!ican && DESC_OVERRIDE[row.SheetNumber]) ican = DESC_OVERRIDE[row.SheetNumber];
  const desc = ican ? ('Students learn to ' + ican.charAt(0).toLowerCase() + ican.slice(1) + '.') : '';
  return {
    num: row.SheetNumber,
    name,
    grade: g,
    gradeLabel: row.Grade,
    ccss,
    strand,
    strandName: STRAND_NAME[strand] || row.Bundle,
    bundle: row.Bundle,
    live, free,
    url: row.TPT_URL,
    desc,
    ccssText: CCSS_TEXT[ccss] || '',
    about: SHEET_ABOUT[row.SheetNumber] || desc,
    slug: slugify(name)
  };
});

/* ---- unique page slug per product (dedupe collisions by appending grade) ---- */
(() => {
  const counts = {};
  products.forEach(p => { counts[p.slug] = (counts[p.slug] || 0) + 1; });
  products.forEach(p => {
    p.pageSlug = counts[p.slug] > 1 ? `${p.slug}-grade-${p.grade}` : p.slug;
    p.pageUrl = `/sheets/${p.pageSlug}.html`;
  });
})();

/* ---- resolve product thumbnail: prefer .jpg (optimized web asset), then .png.
        hasThumb=false -> card/sheet shows CSS fallback art, OG uses default image. ---- */
(() => {
  const SRC = path.join(ROOT, 'assets', 'images', 'thumbs');
  products.forEach(p => {
    const base = `thumb1_${p.grade}th_${p.slug}`;
    let ext = null;
    for (const e of ['jpg', 'png']) {
      try { if (fs.existsSync(path.join(SRC, `${base}.${e}`))) { ext = e; break; } } catch (_) {}
    }
    p.hasThumb = !!ext;
    p.thumbExt = ext || 'jpg';
    p.thumbWeb = `/assets/images/thumbs/${base}.${p.thumbExt}`;
    p.thumbAbs = SITE_URL + p.thumbWeb;
  });
})();

/* ---- resolve bundles: member products, paths, and reverse sheet->bundles map ---- */
const productByNum = {};
products.forEach(p => { productByNum[String(p.num)] = p; });
const bundles = BUNDLES.map(b => {
  const nums = (b.tier === 'ultimate' && (!b.sheets || !b.sheets.length))
    ? products.map(p => Number(p.num))
    : b.sheets.slice();
  const members = nums.map(n => productByNum[String(n)]).filter(Boolean);
  const SRCB = path.join(ROOT, 'assets', 'images', 'bundles');
  // Bundle thumbnail source filename comes from the authored `thumb` field in BUNDLES.
  // Source files may be stored with spaces (legacy) OR underscores (zip-extracted/renamed).
  // The web output always uses a space-free filename so URLs never need encoding.
  // We probe disk for both forms and use whichever exists.
  const authoredThumb = b.thumb || `bundle_${b.slug}.jpg`;
  const underscored = authoredThumb.replace(/\s+/g, '_');
  let srcThumb = authoredThumb;        // actual file on disk to copy from
  let hasThumb = false;
  try {
    if (fs.existsSync(path.join(SRCB, authoredThumb))) { hasThumb = true; srcThumb = authoredThumb; }
    else if (fs.existsSync(path.join(SRCB, underscored))) { hasThumb = true; srcThumb = underscored; }
  } catch (_) {}
  const webThumb = underscored;        // always emit the space-free name
  const thumbRel = `/assets/images/bundles/${webThumb}`;
  return Object.assign({}, b, {
    members,
    count: members.length,
    pageUrl: `/bundles/${b.slug}.html`,
    hasThumb,
    srcThumb,
    webThumb,
    thumbWeb: thumbRel,
    thumbAbs: `${SITE_URL}${thumbRel}`,
    gradeLabel: b.grade === 'all' ? 'Grades 6–8' : `${b.grade}th Grade`
  });
});
/* reverse map: product num -> bundles that contain it (skip mega/ultimate for the per-sheet cross-link) */
const bundlesBySheet = {};
bundles.forEach(b => {
  if (b.tier === 'mega' || b.tier === 'ultimate') return;
  b.members.forEach(p => {
    (bundlesBySheet[String(p.num)] = bundlesBySheet[String(p.num)] || []).push(b);
  });
});

const live = products.filter(p => p.live);
const byGrade = g => products.filter(p => p.grade === g);
const counts = { all: products.length, 6: byGrade('6').length, 7: byGrade('7').length, 8: byGrade('8').length, free: products.filter(p => p.free).length };


/* ============================================================================
   STANDARDS CONTENT (authored S5) — 93 standards, all grades 6-8.
   Source: per-sheet skill_sheet_config_*.js (misconceptions, error-analysis,
   key rules, worked examples). Generated by transform_standards.js.
   Keys: clean CCSS leaf code. slug: URL path under /standards/.
   sheets[]: SheetNumber(s) from Master_Catalog_Skills.csv (multi-sheet standards grouped).
   ============================================================================ */
const STANDARDS_CONTENT = {
  '6.EE.A.1': {
    ccss: '6.EE.A.1', slug: '6-ee-a-1-order-of-operations',
    title: 'Order of Operations & Exponents', grade: '6', strand: 'EE', sheets: [1, 16],
    explanation: [
      'At this standard, students evaluate numerical expressions using the correct order of operations (PEMDAS).',
      'The anchor students hold onto: Parentheses first, then Exponents, then Multiplication/Division (left to right), then Addition/Subtraction (left to right). Remember: PEMDAS. aⁿ means the BASE (a) is used as a factor n times. The EXPONENT counts the factors. NEVER multiply base × exponent.',
      'Where this leads next: writing and evaluating expressions with variables (6.EE.A.2).',
    ],
    examples: [
      { label: 'Parentheses + Exponents', problem: '3 + 2² × (5 − 3)', steps: ['P: (5 − 3) = 2 → 3 + 2² × 2', 'E: 2² = 4 → 3 + 4 × 2', 'M: 4 × 2 = 8 → 3 + 8', 'A: 3 + 8 = 11'], answer: '11' },
      { label: 'Left-to-Right Rule', problem: '20 − 4 × 3 + 2', steps: ['No parentheses or exponents.', 'M: 4 × 3 = 12 → 20 − 12 + 2', 'Left to right: 20 − 12 = 8 → 8 + 2', 'A: 8 + 2 = 10'], answer: '10' },
      { label: '', problem: '4 × 4 × 4 = ?', steps: ['Count how many times 4 appears: 3 times.', 'Write in exponential form: 4³', '4³'], answer: '4³' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Apply ×/÷ left to right before +/− — multiply first, then add. Second: Exponents come before ×/÷ — resolve the power before multiplying.'
  },
  '6.EE.A.2a': {
    ccss: '6.EE.A.2a', slug: '6-ee-a-2a-writing-algebraic-expressions',
    title: 'Writing Algebraic Expressions', grade: '6', strand: 'EE', sheets: [17],
    explanation: [
      'At this standard, students write algebraic expressions to represent word phrases.',
      'The anchor students hold onto: Translate each phrase to its algebraic symbol. For subtraction, ORDER MATTERS — "less than" and "subtracted from" REVERSE the order of terms.',
      'Sheet #18 Evaluating Expressions builds directly on this skill — students substitute values and compute the expressions written here. Subtraction-order patterns carry forward to equation work.',
    ],
    examples: [
      { label: '', problem: '3 more than twice n = ?', steps: ['"twice n" → 2n; "3 more than" → +3', 'Write: 2n + 3', '2n + 3'], answer: '2n + 3' },
      { label: '', problem: '10 less than a number n = ?', steps: ['"less than n" → subtract FROM n', '10 subtracted from n → n − 10', 'n − 10'], answer: 'n − 10' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: 3n means 3 × n. "The sum of n and 3" is n + 3. Second: "Less than" reverses order: "8 less than n" = n − 8, not 8 − n.'
  },
  '6.EE.A.2b': {
    ccss: '6.EE.A.2b', slug: '6-ee-a-2b-identifying-parts-of-an-expression',
    title: 'Identifying Parts of an Expression', grade: '6', strand: 'EE', sheets: [64],
    explanation: [
      'At this standard, students identify and name the parts of algebraic expressions using the terms sum, term, product, factor, quotient, and coefficient, and will view one or more parts (such as a parenthesized group) as a single entity.',
      'The anchor students hold onto: SUM → made of TERMS. PRODUCT → made of FACTORS. A COEFFICIENT is the number multiplying a variable. A group like (x + 4) can be one entity.',
      'This completes the 6th-grade Expressions & Equations strand. Reading expression structure prepares students to rewrite and expand expressions in 7th grade (7.EE.A).',
    ],
    examples: [
      { label: 'A Sum with a Coefficient', problem: 'Name the parts of 5x + 8', steps: ['Terms: 5x and 8', 'Coefficient of x: 5', 'Whole = a sum'], answer: 'Sum; terms 5x and 8; coefficient 5' },
      { label: 'A Product of Two Factors', problem: 'Name the parts of 6(n + 2)', steps: ['Product: 6 × (n + 2)', 'Factors: 6 and (n + 2)', '(n + 2) = one entity'], answer: 'Product; factors 6 and (n + 2)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: A coefficient multiplies a variable. In 5x + 8, the coefficient is 5; the 8 is a constant term. Second: Terms are parts of a SUM. Parts of a PRODUCT are called factors. Find the main operation first.'
  },
  '6.EE.A.2c': {
    ccss: '6.EE.A.2c', slug: '6-ee-a-2c-evaluating-expressions',
    title: 'Evaluating Expressions', grade: '6', strand: 'EE', sheets: [18],
    explanation: [
      'At this standard, students evaluate algebraic expressions by substituting given values.',
      'The anchor students hold onto: SUBSTITUTE → then follow ORDER OF OPERATIONS. Multiply and divide BEFORE you add or subtract.',
      'Sheet #19 Combining Like Terms simplifies expressions before evaluating — the substitution fluency here is essential for all future equation-solving work.',
    ],
    examples: [
      { label: '', problem: 'Evaluate 4n + 7 when n = 3', steps: ['Substitute n = 3: 4(3) + 7', 'Multiply first: 12 + 7', '19'], answer: '19' },
      { label: '', problem: 'Evaluate 2n² when n = 3', steps: ['Substitute n = 3: 2(3²)', 'Exponent first: 2(9)', '18'], answer: '18' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Order of operations: multiply FIRST. 3(4) + 5 = 12 + 5 = 17. Second: The exponent applies only to n. 2n² = 2(n²) = 2(4²) = 2(16) = 32.'
  },
  '6.EE.A.3': {
    ccss: '6.EE.A.3', slug: '6-ee-a-3-distributive-property',
    title: 'Distributive Property', grade: '6', strand: 'EE', sheets: [20],
    explanation: [
      'At this standard, students expand expressions by applying the distributive property.',
      'The anchor students hold onto: Distribute the outside factor to EVERY term inside the parentheses — never skip a term.',
      'Sheet #21 Solving One-Step Equations connects directly — distribution simplifies expressions inside equations, preparing students for the inverse-operation solving strategy.',
    ],
    examples: [
      { label: '', problem: 'Expand: 4(n + 3)', steps: ['Outside factor: 4; terms inside: n and 3', 'Multiply: 4 × n = 4n', '4 × 3 = 12 → 4n + 12'], answer: '4n + 12' },
      { label: '', problem: 'Expand: 5(2n − 3)', steps: ['Outside factor: 5; terms inside: 2n and −3', 'Multiply: 5 × 2n = 10n', '5 × (−3) = −15 → 10n − 15'], answer: '10n − 15' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The sign is part of the term: 4 × (−3) = −12. Correct result: 4n − 12. Second: EVERY term inside gets multiplied: 3(n + 2) = 3n + 6. Never skip a term.'
  },
  '6.EE.A.3+A.4': {
    ccss: '6.EE.A.3+A.4', slug: '6-ee-a-3-a-4-combining-like-terms',
    title: 'Combining Like Terms', grade: '6', strand: 'EE', sheets: [19],
    explanation: [
      'At this standard, students simplify expressions by identifying and combining like terms.',
      'The anchor students hold onto: Only LIKE TERMS can be combined. Constants and variable terms are DIFFERENT types — they cannot be added together.',
      'Sheet #20 Distributive Property connects directly — CLT gathers terms (3n+2n=5n) while distribution expands them. Both skills together prepare students for writing and solving equations.',
    ],
    examples: [
      { label: '', problem: 'Simplify: 3n + 2n', steps: ['Identify like terms: 3n and 2n (same variable)', 'Add coefficients: 3 + 2 = 5', '5n'], answer: '5n' },
      { label: '', problem: 'Simplify: 5x + 3 − 2x', steps: ['Variable terms: 5x and −2x; constant: 3', '5x − 2x = 3x', '3x + 3'], answer: '3x + 3' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: 3n and 2 are NOT like terms — one has a variable, one is a constant. Answer stays 3n + 2. Second: When no number is written in front of a variable, the coefficient is 1, not 0. n = 1n.'
  },
  '6.EE.A.4': {
    ccss: '6.EE.A.4', slug: '6-ee-a-4-identifying-equivalent-expressions',
    title: 'Identifying Equivalent Expressions', grade: '6', strand: 'EE', sheets: [24],
    explanation: [
      'At this standard, students identify when two expressions are equivalent using two strategies: (1) simplifying via combining like terms (CLT) or the distributive property (DP) until both expressions match, and (2) verifying by substituting a value. Students distinguish equivalent (same value for ALL substitutions) from simply equal for one specific value. Note: Problem 15 (D-1=V) verifies x=1 in both 2(x+3) and 2x+6; Problem 16 (R-D=ii) requires writing the expanded form and verifying with x=2.',
      'The anchor students hold onto: Simplify both → same form? EQUIVALENT — Test values → all equal? EQUIVALENT',
      'Equivalence underlies solutions: a value solves an equation when it makes both sides equal. Leads to 6.EE.B.5+B.6 (testing solutions) and 7.EE.A+B expression reasoning in 7th grade.',
    ],
    examples: [
      { label: 'Combining Like Terms', problem: 'Are 4x + 3x and 7x equivalent?', steps: ['Both terms have x — they are LIKE TERMS', 'Combine: 4x + 3x = 7x', 'Test x = 2: 8 + 6 = 14 and 7 × 2 = 14 OK'], answer: '4x + 3x = 7x — EQUIVALENT' },
      { label: 'Distributive Property', problem: '2(x+5) vs. 2x+10: equivalent?', steps: ['Distribute: 2(x + 5) = 2 × x + 2 × 5', 'Simplify: 2x + 10', 'Test x = 3: 2(8) = 16 and 6 + 10 = 16 OK'], answer: '2(x + 5) = 2x + 10 — EQUIVALENT' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Equivalent means the same value for EVERY substitution. Test at least two values, or simplify both sides to the same form, to be certain. Second: The factor multiplies EVERY term inside the parentheses: 4 × x AND 4 × 3 = 4x + 12. Distribute to all terms.'
  },
  '6.EE.B.5+B.6': {
    ccss: '6.EE.B.5+B.6', slug: '6-ee-b-5-b-6-solutions-to-equations-writing-variables',
    title: 'Solutions to Equations & Writing Variables', grade: '6', strand: 'EE', sheets: [25],
    explanation: [
      'At this standard, students use variables to represent unknowns and write expressions and equations from word phrases (6.EE.B.6), then use substitution to check whether a given value is a solution (6.EE.B.5). Ramp: P1-4 write expressions, P5-8 write equations, P9-12 check solutions YES/NO, P13-16 write + check integrated. B.5 inequality domain deferred to #26.',
      'The anchor students hold onto: Substitute the value -> evaluate both sides -> equal = SOLUTION',
      'Solution-checking extends directly to inequalities: test a value in x > c or x < c. Leads to 6.EE.B.8 (#26 InequalitiesAndGraphs) and 7.EE.B equation-solving in 7th grade.',
    ],
    examples: [
      { label: 'Writing an Expression', problem: 'Six more than a number', steps: ['\'Six more than\' -> add 6 to the number', '\'A number\' -> variable n', 'Expression: n + 6'], answer: 'n + 6' },
      { label: 'Writing an Equation and Checking', problem: 'A number minus 3 equals 8', steps: ['Write the equation: n - 3 = 8', 'Check n = 11: 11 - 3 = 8 -- TRUE', 'n = 11 is a SOLUTION'], answer: 'n - 3 = 8; n = 11 is the solution' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: "3 less than n" subtracts 3 FROM n: write n - 3, not 3 - n. Second: After substituting, simplify both sides separately, then compare: if they match, it IS a solution.'
  },
  '6.EE.B.7': {
    ccss: '6.EE.B.7', slug: '6-ee-b-7-solving-one-step-equations',
    title: 'Solving One-Step Equations', grade: '6', strand: 'EE', sheets: [21],
    explanation: [
      'At this standard, students solve one-step equations using inverse operations.',
      'The anchor students hold onto: Use the INVERSE OPERATION — undo what was done to the variable, applying the same step to BOTH sides of the equation.',
      'The inverse-operation strategy extends to inequalities (6.EE.B.8) — solving x + p < q and px > q uses the same steps, but solutions become ranges on a number line rather than single values.',
    ],
    examples: [
      { label: '', problem: 'Solve: n + 6 = 14', steps: ['Operation: + 6; inverse: − 6', 'Subtract 6 from both sides: n = 14 − 6', 'n = 8'], answer: 'n = 8' },
      { label: '', problem: 'Solve: n/3 = 7', steps: ['Operation: ÷ 3; inverse: × 3', 'Multiply both sides by 3: n = 7 × 3', 'n = 21'], answer: 'n = 21' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: To undo multiplication, DIVIDE both sides: n = 48 ÷ 6 = 8. Use the inverse operation. Second: Use the INVERSE: subtract 8 from both sides — n = 15 − 8 = 7.'
  },
  '6.EE.B.8': {
    ccss: '6.EE.B.8', slug: '6-ee-b-8-inequalities-their-graphs',
    title: 'Inequalities & Their Graphs', grade: '6', strand: 'EE', sheets: [26],
    explanation: [
      'At this standard, students write inequalities (x > c, x < c) from real-world constraints (6.EE.B.8), graph solutions on number lines with open circle and shading, and check whether specific values are solutions via substitution (6.EE.B.5-IQ carry-forward from #25). Ramp: P1-4 solution-check, P5-8 write from words, P9-14 graph with number-line visual, P15-16 integrated.',
      'The anchor students hold onto: x > c: shade right · x < c: shade left',
      'This closes the 6th Grade EE strand. Inequality forms extend to 7th grade EE. Next: Statistics and Probability -- #27 Measures of Center (6.SP.B.5a+5b) -- mean, median, and data distributions.',
    ],
    examples: [
      { label: 'Writing an Inequality', problem: 'Fewer than 6 students absent.', steps: ['\'Fewer than\' means less than -- use <', '\'6 students\' -> c = 6; unknown -> variable n', 'Inequality: n < 6'], answer: 'n < 6' },
      { label: 'Checking a Solution', problem: 'Is n = 2 a solution to n > 1?', steps: ['Substitute n = 2: is 2 > 1?', '2 > 1 -- TRUE', 'YES -- n = 2 IS a solution'], answer: 'YES -- n = 2 is a solution' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: > means GREATER THAN -- shade right toward larger values. < means LESS THAN -- shade left. Second: x > c and x < c do NOT include the boundary value -- always use an OPEN circle.'
  },
  '6.EE.C.9': {
    ccss: '6.EE.C.9', slug: '6-ee-c-9-independent-vs-dependent-variables',
    title: 'Independent vs. Dependent Variables', grade: '6', strand: 'EE', sheets: [23],
    explanation: [
      'At this standard, students identify independent and dependent variables in real-world contexts, write equations expressing the dependent variable in terms of the independent variable, complete tables of values, and analyze relationships using graphs. Note: Problem 15 (R-D=ii) asks students to write an equation AND verify an ordered pair satisfies it — multi-representation synthesis bridging this standard with coordinate-plane work from #22.',
      'The anchor students hold onto: x = independent (input) · y = dependent (output)',
      'Variable relationships extend to inequalities (6.EE.B.8) and later drive proportional reasoning (7.RP.A.2) and linear function graphing (8.EE.B) in grades 7 and 8.',
    ],
    examples: [
      { label: 'Identify Variables', problem: 'Notebooks cost 3 dollars each.', steps: ['Independent: number of notebooks (n) — you choose how many', 'Dependent: total cost (c) — depends on number of notebooks', 'Equation: c = 3 × n'], answer: 'x = n (notebooks); y = c (cost); c = 3n' },
      { label: 'Table to Equation', problem: 'Table: (1,8), (2,16), (3,24).', steps: ['Rate: 8 ÷ 1 = 16 ÷ 2 = 24 ÷ 3 = 8 dollars per hour', 'Independent: hours (x); Dependent: pay (y)', 'Equation: y = 8 × x'], answer: 'y = 8x' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Ask which quantity changes freely — that is always x. The dependent variable (y) goes alone on the left side: y = [rate] × x. Second: Independent means it changes on its own — not that it is more important. Hours, distance, or items chosen freely by the user are the independent variables.'
  },
  '6.G.A.1': {
    ccss: '6.G.A.1', slug: '6-g-a-1-area-of-polygons',
    title: 'Area of Polygons', grade: '6', strand: 'G', sheets: [31],
    explanation: [
      'At this standard, students find the area of right triangles, general triangles, parallelograms, trapezoids, and composite polygons by identifying base and perpendicular height and applying the correct area formula.',
      'The anchor students hold onto: To find the area of a polygon, identify the base and perpendicular height, then apply the correct formula for the shape.',
      'Area of polygons (6.G.A.1) connects to finding volume of prisms with fractional edge lengths in Sheet #32.',
    ],
    examples: [
      { label: 'Right Triangle', problem: 'Find the area. b=6 cm, h=8 cm.', steps: ['A = 1/2 x base x height', 'A = 1/2 x 6 x 8', 'A = 1/2 x 48', 'A = 24 sq cm'], answer: '24 sq cm' },
      { label: 'General Triangle', problem: 'Find the area. b=10 m, h=4 m.', steps: ['A = 1/2 x base x height', 'A = 1/2 x 10 x 4', 'A = 1/2 x 40', 'A = 20 sq m'], answer: '20 sq m' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: A triangle is exactly HALF of a parallelogram with the same base and height. The formula is A = 1/2 x b x h. Always check: is this a triangle? If yes, multiply by 1/2. Second: Height must be perpendicular (90°) to the base. Draw a dashed line from the base straight up to the opposite vertex — that vertical distance is the height, not the slant side.'
  },
  '6.G.A.2': {
    ccss: '6.G.A.2', slug: '6-g-a-2-volume-with-fractional-edge-lengths',
    title: 'Volume with Fractional Edge Lengths', grade: '6', strand: 'G', sheets: [32],
    explanation: [
      'At this standard, students find the volume of right rectangular prisms with fractional edge lengths by applying V = l x w x h and V = B x h, converting mixed numbers to improper fractions, and solving real-world problems.',
      'The anchor students hold onto: To find the volume of a rectangular prism, multiply all three edge lengths: V = l x w x h. Always convert mixed numbers to improper fractions first.',
      'Where this leads next: Nets & Surface Area (6.G.A.4, Sheet #101) — unfold 3D prisms to compute total surface area.',
    ],
    examples: [
      { label: 'V = l x w x h', problem: 'Find V: l=5/2, w=3/2, h=4 (ft).', steps: ['V = l x w x h', 'l = 2 1/2 = 5/2; w = 1 1/2 = 3/2', 'V = 5/2 x 3/2 x 4 = 15/4 x 4', 'V = 15 ft³'], answer: '15 ft³' },
      { label: 'V = B x h', problem: 'V=Bh. B=4 1/2 sq in, h=2 in.', steps: ['V = B x h', 'B = 4 1/2 = 9/2 sq in', 'V = 9/2 x 2 = 18/2', 'V = 9 in³'], answer: '9 in³' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Convert ALL mixed numbers to improper fractions FIRST: 2 1/2 = 5/2. Then multiply as a single fraction: 5/2 x 3 = 15/2 = 7.5. Never split a mixed number mid-computation. Second: In V = B x h, B is BASE AREA — a two-factor product for rectangular prisms: B = l x w. Always compute B = l x w first, then multiply by h.'
  },
  '6.G.A.3': {
    ccss: '6.G.A.3', slug: '6-g-a-3-polygons-coordinate-plane',
    title: 'Polygons & Quadrilaterals on the Coordinate Plane', grade: '6', strand: 'G', sheets: [27, 28],
    explanation: [
      'At this standard, students plot quadrilateral vertices on the coordinate plane, connect them to form quadrilaterals, and find horizontal and vertical side lengths using coordinate subtraction.',
      'The anchor students hold onto: Horizontal side (same y): length = |x₂ − x₁|. Vertical side (same x): length = |y₂ − y₁|. Horizontal side (same y): length = |x₂ − x₁|. Vertical side (same x): length = |y₂ − y₁|.',
      'Coordinate plane geometry connects to polygon side lengths in sheet #28 (6.G.A.3), real-world area problems (6.G.A.1), and extends through 7th-grade rational number work on four-quadrant planes.',
    ],
    examples: [
      { label: '', problem: 'Draw rect ABCD; find perimeter.', steps: ['AB: same y (y=1) → |6−1| = 5 units', 'BC: same x (x=6) → |4−1| = 3 units', 'P = 5 + 3 + 5 + 3 = 16 units'], answer: 'P = 16 units' },
      { label: '', problem: 'Find EF: E(2,6) and F(2,1).', steps: ['Same x-coordinate (x = 2) → vertical side', 'EF = |6 − 1| = 5 units'], answer: 'EF = 5 units' },
      { label: '', problem: 'Find the two legs of △PQR.', steps: ['P(0,0), Q(4,0), R(4,3) — plot and connect.', 'PQ: same y (y = 0) → horizontal: |4 − 0| = 4 units', 'QR: same x (x = 4) → vertical: |3 − 0| = 3 units', 'PR is diagonal — coordinate subtraction does not apply.'], answer: 'PQ = 4 units; QR = 3 units' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Side length uses subtraction: |x₂ − x₁| for horizontal or |y₂ − y₁| for vertical sides. Second: A quadrilateral has four sides. Add all four side lengths to find the perimeter.'
  },
  '6.G.A.4': {
    ccss: '6.G.A.4', slug: '6-g-a-4-nets-surface-area',
    title: 'Nets & Surface Area', grade: '6', strand: 'G', sheets: [101],
    explanation: [
      'At this standard, students represent rectangular and triangular prisms as nets, identify the rectangular and triangular faces, and use the nets to compute total surface area in mathematical and real-world problems.',
      'The anchor students hold onto: To find surface area, identify every face of the solid, find the area of each face, then add them all up.',
      'Where this leads next: 7th-grade geometry — scale drawings, area of circles, and surface area of more complex solids.',
    ],
    examples: [
      { label: 'Rectangular Prism', problem: 'l=6, w=4, h=3 cm. Find SA.', steps: ['Top/Bottom: 2(6x4) = 48', 'Front/Back: 2(6x3) = 36', 'Left/Right: 2(4x3) = 24', 'SA = 48 + 36 + 24 = 108 cm²'], answer: '108 cm²' },
      { label: 'Triangular Prism', problem: 'Legs 3 & 4 in (hyp 5); L=8.', steps: ['2 triangles: 2(1/2 x 3 x 4) = 12', '3 rects: (3+4+5) x 8 = 96', 'SA = 12 + 96 = 108 in²'], answer: '108 in²' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: A rectangular prism ALWAYS has 6 faces — 3 congruent pairs (top/bottom, front/back, left/right). Use SA = 2lw + 2lh + 2wh to ensure all 3 pairs are counted. Second: Surface area = sum of face AREAS (square units). Volume = 3D space inside (cubic units). For SA: find the area of each face, then add. Check: the answer must be in square units (cm², ft²).'
  },
  '6.NS.A.1': {
    ccss: '6.NS.A.1', slug: '6-ns-a-1-dividing-fractions-by-fractions',
    title: 'Dividing Fractions by Fractions', grade: '6', strand: 'NS', sheets: [11],
    explanation: [
      'At this standard, students compute quotients of fractions using the reciprocal (keep-change-flip) method and interpret fraction division in word-problem contexts.',
      'The anchor students hold onto: Keep the dividend, change ÷ to ×, flip the divisor to its reciprocal — then multiply across and simplify.',
      'Dividing fractions (6.NS.A.1) builds directly toward operations with all rational numbers, including negative fractions, in 7th grade (7.NS.A.2).',
    ],
    examples: [
      { label: 'Keep-Change-Flip', problem: 'Find: 2/3 ÷ 5/6.', steps: ['Keep 2/3, change ÷ to ×', 'Flip 5/6 → reciprocal is 6/5', '2/3 × 6/5 = 12/15', 'Simplify: 12/15 = 4/5'], answer: '4/5' },
      { label: 'Measurement Meaning', problem: 'Find: 2/3 ÷ 1/6.', steps: ['How many 1/6 are in 2/3?', 'Keep 2/3 · flip 1/6 → 6/1', '2/3 × 6/1 = 12/3 = 4', '4 sixths fit exactly in 2/3'], answer: '4' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Always keep the first fraction exactly as written; flip ONLY the divisor (second fraction). Second: Dividing by a fraction less than 1 makes the quotient LARGER — more pieces fit into the dividend.'
  },
  '6.NS.B.2+B.3': {
    ccss: '6.NS.B.2+B.3', slug: '6-ns-b-2-b-3-multi-digit-operations',
    title: 'Multi-Digit Operations', grade: '6', strand: 'NS', sheets: [12],
    explanation: [
      'At this standard, students apply the standard algorithm for long division of multi-digit whole numbers and all four operations with multi-digit decimals, emphasizing place-value reasoning and decimal-point placement.',
      'The anchor students hold onto: Whole-number division: Divide → Multiply → Subtract → Bring Down. Decimals: align points to add/subtract; count total decimal places to multiply; shift the decimal to make a whole divisor before dividing.',
      'Multi-digit computation fluency (6.NS.B.2+B.3) extends directly to operations with rational numbers involving negatives in 7.NS.A, and supports decimal reasoning in 6.RP.A proportional problems.',
    ],
    examples: [
      { label: 'Whole-Number Long Division', problem: 'Divide 3,276 ÷ 7.', steps: ['7 into 32 = 4 R 4; write 4 above tens digit', 'Bring down 7 → 47; 7 into 47 = 6 R 5; write 6', 'Bring down 6 → 56; 7 into 56 = 8; write 8', '3,276 ÷ 7 = 468'], answer: '468' },
      { label: 'Multiplying Decimals', problem: 'Multiply 3.6 × 2.4.', steps: ['Ignore decimals: 36 × 24 = 864', 'Count decimal places: 1 + 1 = 2', 'Place decimal 2 from right: 8.64'], answer: '8.64' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Count decimal places in BOTH factors and ADD them — 4.5 (1 place) × 2.8 (1 place) = 2 total places → 12.6. Second: Line up the decimal points, write 14.30 − 9.75, then borrow column by column from right to left — answer is 4.55.'
  },
  '6.NS.B.4': {
    ccss: '6.NS.B.4', slug: '6-ns-b-4-gcf-and-lcm',
    title: 'Greatest Common Factor & Least Common Multiple', grade: '6', strand: 'NS', sheets: [2, 3],
    explanation: [
      'At this standard, students find the greatest common factor of two or three whole numbers using the listing-factors method and the prime-factorization method.',
      'The anchor students hold onto: List all factors of each number and circle the largest one they share — OR write each number as a product of prime factors and multiply the primes that appear in every list. List the multiples of each number until you find the first one they share — OR write each number as a product of primes and multiply using the highest power of each prime.',
      'GCF and LCM are companion skills in 6.NS.B.4. The LCM becomes the common denominator when adding unlike fractions in 6.NS.A.1 — both concepts appear together on that standard.',
    ],
    examples: [
      { label: 'Listing Factors', problem: 'Find the GCF of 12 and 18.', steps: ['Factors of 12: 1, 2, 3, 4, 6, 12', 'Factors of 18: 1, 2, 3, 6, 9, 18', 'Common factors: 1, 2, 3, 6', 'Greatest: GCF = 6'], answer: '6' },
      { label: 'Prime Factorization', problem: 'Find the GCF of 24 and 36.', steps: ['24 = 2 × 2 × 2 × 3', '36 = 2 × 2 × 3 × 3', 'Shared primes: 2 × 2 × 3', 'GCF = 12'], answer: '12' },
      { label: 'Listing Multiples', problem: 'Find the LCM of 4 and 6.', steps: ['Multiples of 4: 4, 8, 12, 16..', 'Multiples of 6: 6, 12, 18..', 'First match: 12', 'LCM = 12'], answer: '12' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: List ALL common factors before choosing — 1, 2, 3, 6 are all common factors of 12 and 18, so GCF = 6. Second: A factor must DIVIDE INTO both numbers — it cannot be larger than either. 36 > 6, so 36 cannot be a factor of 6. GCF = 6.'
  },
  '6.NS.C.5+C.6a': {
    ccss: '6.NS.C.5+C.6a', slug: '6-ns-c-5-c-6a-positive-negative-numbers-in-context',
    title: 'Positive & Negative Numbers in Context', grade: '6', strand: 'NS', sheets: [13],
    explanation: [
      'At this standard, students write signed numbers for real-world contexts, explain the meaning of 0, and identify opposites on a number line, including recognizing that −(−n) = n.',
      'The anchor students hold onto: Opposite numbers are the same distance from 0 but on opposite sides. −(−n) = n.',
      'Signed integers (6.NS.C.5+C.6a) lead to Rationals on Number Line & Coord Plane (6.NS.C.6c): fractions, decimals, and rational numbers on the number line and coordinate plane.',
    ],
    examples: [
      { label: 'Writing a Signed Number', problem: 'Write: 40 feet below sea level.', steps: ['Below sea level = negative direction', '40 feet below → −40', '0 = sea level (reference point)'], answer: '−40 feet' },
      { label: 'Opposites and −(−n)', problem: 'Opposite of −6? Simplify −(−6).', steps: ['−6 is 6 units to the LEFT of 0', 'Its opposite is 6 units to the RIGHT of 0: +6', '−(−6) = 6 (opposite of the opposite = original)'], answer: 'Opposite: +6; −(−6) = 6' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Taking the opposite always changes the sign: the opposite of −8 is +8. Second: −(−n) means taking the opposite, not multiplying. The opposite of −6 is +6, so −(−6) = 6.'
  },
  '6.NS.C.6b': {
    ccss: '6.NS.C.6b', slug: '6-ns-c-6b-the-coordinate-plane',
    title: 'The Coordinate Plane', grade: '6', strand: 'NS', sheets: [9],
    explanation: [
      'Students read the signs of an ordered pair to name the quadrant a point falls in, plot signed ordered pairs on the four-quadrant coordinate plane, and recognize that two points whose coordinates differ only in sign are reflections of each other across the x-axis, the y-axis, or both axes.',
      'The anchor students hold onto: Signs name the quadrant: (+,+) = I, (−,+) = II, (−,−) = III, (+,−) = IV. Flip one sign → reflect across the axis that controls it.',
      'Naming quadrants and reflecting across axes prepares students for coordinate-plane distances (6.NS.C.8), polygon vertices (6.G.A.3), and four-quadrant graphing throughout grades 7–8.',
    ],
    examples: [
      { label: '', problem: 'Which quadrant holds (−3, 5)?', steps: ['x = −3 (negative), y = 5 (positive)', 'Signs: (−, +)', 'Match to quadrant map → Quadrant II'], answer: 'Quadrant II' },
      { label: '', problem: 'Reflect (4, 2) across x-axis.', steps: ['Reflecting over x-axis flips the sign of y', '(4, 2): keep x = 4; flip y: 2 → −2', 'Image = (4, −2)'], answer: '(4, −2)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: x is always first: move horizontally (left/right) for x, then vertically (up/down) for y. Second: The quadrant depends on BOTH signs: (−, +) → Quadrant II; (−, −) → Quadrant III.'
  },
  '6.NS.C.6c': {
    ccss: '6.NS.C.6c', slug: '6-ns-c-6c-rationals-on-number-line-coord-plane',
    title: 'Rationals on Number Line & Coord Plane', grade: '6', strand: 'NS', sheets: [14],
    explanation: [
      'At this standard, students read the scale of a number line, plot rational numbers (fractions and decimals) on a horizontal number line, and plot and read ordered pairs with integer and rational coordinates on a coordinate plane.',
      'The anchor students hold onto: To plot a rational: find the tick value (span ÷ equal parts), then count ticks from 0. For ordered pairs: move x (horizontal) first, then y (vertical).',
      'Plotting rationals (6.NS.C.6c) leads directly into comparing and ordering rational numbers and absolute value in Sheet #15.',
    ],
    examples: [
      { label: 'Plot on Number Line', problem: 'Plot 3/4. Axis: 0 to 1, 4 parts.', steps: ['Tick value: 1 ÷ 4 = 1/4 per tick', 'Count 3 ticks RIGHT of 0', 'Plot dot at 3/4'], answer: '3/4 (between 0 and 1)' },
      { label: 'Plot Ordered Pair', problem: 'Plot (−3, 2) on the CP.', steps: ['x = −3: move 3 units LEFT from origin', 'y = 2: from there, move 2 units UP', 'Plot at (−3, 2) — Quadrant II'], answer: '(−3, 2) — Quadrant II' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The denominator tells how many equal PARTS (intervals), not how many ticks. 3/4 means 3 of 4 parts — place the dot at the 3rd tick, not the 4th. Second: Always move HORIZONTAL (x) first, then VERTICAL (y). For (3, −2): move RIGHT 3 from the origin, then DOWN 2.'
  },
  '6.NS.C.7': {
    ccss: '6.NS.C.7', slug: '6-ns-c-7-comparing-ordering-rationals-absolute-value',
    title: 'Comparing/Ordering Rationals & Absolute Value', grade: '6', strand: 'NS', sheets: [15],
    explanation: [
      'At this standard, students compare and order rational numbers on a number line, write and interpret inequalities in real-world contexts, compute absolute value as distance from 0, and distinguish absolute-value comparisons from order comparisons.',
      'The anchor students hold onto: On a number line, the number farther to the RIGHT is always the GREATER number. Absolute value = distance from 0; it never depends on the sign.',
      'Comparing and ordering rational numbers and using absolute value closes the Rational Numbers strand; the Expressions and Equations strand opens next with exponents.',
    ],
    examples: [
      { label: '', problem: 'Compare −4 and −1. Use < or >.', steps: ['Plot: −4 is to the LEFT of −1 on the number line', 'Number farther RIGHT is greater → −1 is right of −4', '−4 < −1'], answer: '−4 < −1' },
      { label: '', problem: 'Find |−5|. Explain on the NL.', steps: ['|−5| = distance from 0 to −5 on the number line', 'Count: −5 is 5 units away from 0', '|−5| = 5'], answer: '|−5| = 5' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Ignore digits alone. Place both on a number line: −3 is farther RIGHT than −8, so −3 > −8. Second: Order and absolute value can point opposite ways for negatives. −9 < −5 in order, but |−9| = 9 > |−5| = 5.'
  },
  '6.NS.C.8': {
    ccss: '6.NS.C.8', slug: '6-ns-c-8-real-world-problems-on-coordinate-plane',
    title: 'Real-World Problems on Coordinate Plane', grade: '6', strand: 'NS', sheets: [22],
    explanation: [
      'At this standard, students solve real-world problems using points on a coordinate plane.',
      'The anchor students hold onto: Same y → |x₁ − x₂| · Same x → |y₁ − y₂|',
      'Variables in an ordered pair (x, y) represent two related quantities — the basis for 6.EE.C.9, where the coordinate plane shows how one variable changes as another changes.',
    ],
    examples: [
      { label: '', problem: 'Park: (−3, 2); Library: (4, 2)', steps: ['Both at y = 2 — share y-coordinate', 'Distance = |−3 − 4| = |−7| = 7', '7 units'], answer: '7 units' },
      { label: '', problem: 'A(−2, 5); B(−2, −3)', steps: ['Both at x = −2 — share x-coordinate', 'Distance = |5 − (−3)| = |8| = 8', '8 units'], answer: '8 units' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Distance is always positive. Use absolute value: |x₁ − x₂| or |y₁ − y₂|. Second: The shared-coordinate shortcut only works when both points share the same x OR the same y value.'
  },
  '6.RP.A.1': {
    ccss: '6.RP.A.1', slug: '6-rp-a-1-understanding-ratios',
    title: 'Understanding Ratios', grade: '6', strand: 'RP', sheets: [4],
    explanation: [
      'At this standard, students understand the concept of a ratio, write ratios in three equivalent forms, distinguish between part-to-part and part-to-whole ratios, and use ratio language to describe real-world relationships.',
      'The anchor students hold onto: Write the first quantity named first — use a:b, "a to b," or a/b. Order matters.',
      'Understanding what a ratio is and how to write it sets the foundation for unit rate (6.RP.A.2) and applying ratios in tables, graphs, and equations (6.RP.A.3).',
    ],
    examples: [
      { label: 'Writing a Ratio', problem: 'Write the ratio of dogs to cats.', steps: ['Identify: 4 dogs compared to 3 cats', 'Dogs are named first — write 4 first', '4:3 · 4 to 3 · 4/3', '"For every 4 dogs there are 3 cats."'], answer: '4:3 (also written 4 to 3 or 4/3)' },
      { label: 'Part-to-Whole', problem: '2 red, 5 blue — red to total', steps: ['Total = 2 + 5 = 7', 'Red to total: 2 out of 7', '2:7 · 2 to 7 · 2/7', 'Part-to-whole — total is included.'], answer: '2:7' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Write the first quantity NAMED first — the word order determines the ratio order. Second: Part-to-whole uses the TOTAL of all groups combined, not just the other part.'
  },
  '6.RP.A.2': {
    ccss: '6.RP.A.2', slug: '6-rp-a-2-unit-rate-concept',
    title: 'Unit Rate Concept', grade: '6', strand: 'RP', sheets: [5],
    explanation: [
      'At this standard, students understand unit rate as a ratio with denominator 1, compute unit rates by dividing, and use rate language to describe unit rates in real-world contexts.',
      'The anchor students hold onto: Divide the first quantity by the second — unit rate denominator is always 1.',
      'Unit rate (6.RP.A.2) bridges directly to applying ratio reasoning in tables, graphs, and equations (6.RP.A.3).',
    ],
    examples: [
      { label: 'Unit Rate', problem: '$3.60 earned in 4 hours', steps: ['Identify: $3.60 · 4 hours', 'Divide first ÷ second: $3.60 ÷ 4 = $0.90', 'Unit rate: $0.90 per hour', '"The student earns $0.90 per hour."'], answer: '$0.90 per hour' },
      { label: 'Speed', problem: '150 miles in 3 hours', steps: ['Identify: 150 miles · 3 hours', 'Divide: 150 ÷ 3 = 50', 'Unit rate: 50 miles per hour', '"The car travels 50 miles per hour."'], answer: '50 miles per hour' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Always divide first ÷ second. 120 miles in 3 hours → 120 ÷ 3 = 40 mph. Second: Always label the unit rate with its units. The units tell what each 1 of represents.'
  },
  '6.RP.A.3': {
    ccss: '6.RP.A.3', slug: '6-rp-a-3-ratio-reasoning-application',
    title: 'Ratio Reasoning Application', grade: '6', strand: 'RP', sheets: [6],
    explanation: [
      'At this standard, students use equivalent ratio tables to find missing values and compare ratios, apply percent as a rate per 100 to find parts and wholes, and convert measurement units using ratio reasoning.',
      'The anchor students hold onto: Multiply or divide BOTH quantities by the same scale factor to create equivalent ratios.',
      'Ratio and rate reasoning (6.RP.A.3) bridges to proportional relationships (7.RP.A), scale problems, and percent applications in 7th grade.',
    ],
    examples: [
      { label: 'Ratio Table', problem: 'Ratio table: 2 lemons : 3 cups.', steps: ['Known ratio: 2 lemons : 3 cups', '4 lemons: x2 → 3 x 2 = 6 cups', '6 lemons: x3 → 3 x 3 = 9 cups', '8 lemons: x4 → 3 x 4 = 12 cups'], answer: '4 lemons → 6 cups · 6 lemons → 9 cups · 8 lemons → 12 cups' },
      { label: 'Percent', problem: 'Find 30% of 60.', steps: ['Write percent as a fraction: 30/100', 'Multiply by the whole: 30/100 x 60', '(30 x 60) / 100 = 1800 / 100 = 18', '30% of 60 = 18'], answer: '18' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Multiply BOTH terms by 4: 2 x 4 = 8, 3 x 4 = 12. Adding changes the ratio relationship. Second: Percent means per 100: write 30/100, then multiply by the whole: 30/100 x 60 = 18.'
  },
  '6.SP.A.1': {
    ccss: '6.SP.A.1', slug: '6-sp-a-1-statistical-questions',
    title: 'Statistical Questions', grade: '6', strand: 'SP', sheets: [7],
    explanation: [
      'At this standard, students recognize statistical questions as those that anticipate variability in data, distinguish them from non-statistical questions with a single answer, explain why the answers vary, and generate their own statistical questions for real-world contexts.',
      'The anchor students hold onto: If the answers VARY, the question is statistical. If there is only ONE answer, it is not.',
      'Recognizing statistical questions sets up describing distributions (6.SP.A.2) and choosing measures of center and variability (6.SP.A.3).',
    ],
    examples: [
      { label: 'Not Statistical', problem: 'Is "How old am I?" statistical?', steps: ['Data collected: one person\'s age', 'My age is a single, fixed number', 'Only one answer → no variability', 'NOT a statistical question'], answer: 'Not statistical — only one answer' },
      { label: 'Statistical', problem: 'Classmates\' ages — stat or not?', steps: ['Data collected: every student\'s age', 'Students have many different ages', 'Answers vary → variability exists', 'YES — a statistical question'], answer: 'Statistical — ages vary across students' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: A question is statistical only when answers VARY across a group — not just any data. Second: Class size is one fixed number — variability (different answers), not group size, makes a question statistical.'
  },
  '6.SP.A.2': {
    ccss: '6.SP.A.2', slug: '6-sp-a-2-understanding-distributions',
    title: 'Understanding Distributions', grade: '6', strand: 'SP', sheets: [8],
    explanation: [
      'At this standard, students understand that data collected to answer a statistical question form a distribution, and will describe that distribution three ways: its center (where values cluster), its spread (from lowest to highest), and its overall shape (symmetric, skewed, uniform, with peaks, gaps, or outliers).',
      'The anchor students hold onto: Describe any distribution three ways: CENTER (where values cluster), SPREAD (lowest to highest), and SHAPE (symmetric, skewed, peaks, gaps, outliers).',
      'Describing a distribution by center, spread, and shape sets up choosing and computing measures of center and variability (6.SP.A.3).',
    ],
    examples: [
      { label: 'Center', problem: 'Dot plot peaks at 2. Center?', steps: ['Where data clusters = center', 'Tallest stack of dots is at 2', 'Most students own about 2 pets', 'Center is 2 — typical value'], answer: 'Center is 2 — the typical value' },
      { label: 'Spread', problem: 'Ages dot plot: 9 to 14. Spread?', steps: ['Spread = lowest to highest', 'Lowest age is 9, highest is 14', 'Values reach from 9 to 14', 'Spread: 9 to 14 (range of 5)'], answer: 'Spread: 9 to 14 (range of 5)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Skew is named for the TAIL direction — tail pointing right = skewed right. Second: Center and spread are different features — spread is the range from lowest to highest, regardless of what the center is.'
  },
  '6.SP.A.3': {
    ccss: '6.SP.A.3', slug: '6-sp-a-3-center-vs-variability',
    title: 'Center vs Variability', grade: '6', strand: 'SP', sheets: [10],
    explanation: [
      'At this standard, students find and compare two kinds of summary numbers: a measure of center (mean or median — the typical value) and a measure of variation (range — the spread). Students recognize that each is a single number summarizing the whole set and that center and variation answer different questions.',
      'The anchor students hold onto: Find the CENTER with the mean or median (one typical number). Find the VARIATION with the range (one spread number).',
      'Finding center and variation prepares students to compare data displays and to compute measures like the IQR and mean absolute deviation (6.SP.B.4 and 6.SP.B.5).',
    ],
    examples: [
      { label: 'Mean (center)', problem: 'Mean of 4, 6, 8, 10, 12.', steps: ['Add: 4+6+8+10+12 = 40', 'Count the values: 5', 'Divide: 40 ÷ 5 = 8', 'Mean = 8 (one typical number)'], answer: 'Mean = 8' },
      { label: 'Range (variation)', problem: 'Range of 5, 8, 11, 14, 20.', steps: ['Range = highest − lowest', 'Highest = 20, lowest = 5', '20 − 5 = 15', 'Range = 15 (one spread number)'], answer: 'Range = 15' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Equal means do not guarantee equal spread — always check the range to assess variation. Second: The range measures variation (spread), not center — it tells how spread out, not what is typical.'
  },
  '6.SP.B.4': {
    ccss: '6.SP.B.4', slug: '6-sp-b-4-data-displays-dot-histogram-box-plots',
    title: 'Data Displays: Dot/Histogram/Box Plots', grade: '6', strand: 'SP', sheets: [29],
    explanation: [
      'At this standard, students read and interpret three types of numerical data displays: a dot plot, which stacks one dot for each value; a histogram, which groups values into equal intervals shown as touching bars whose height is the count; and a box plot, which marks the five-number summary (minimum, first quartile, median, third quartile, maximum). Students read counts, intervals, and summary values directly from each display.',
      'The anchor students hold onto: Match the display to the data: a dot plot for exact values, a histogram for grouped intervals, a box plot for the five-number summary.',
      'Reading these displays prepares students to summarize numerical data with measures of center and variability, including the interquartile range and mean absolute deviation (6.SP.B.5).',
    ],
    examples: [
      { label: 'Histogram', problem: 'Counts: 4 in 0–9, 8 in 10–19.', steps: ['Equal intervals of width 10', 'Bar height = count for that interval', 'Tallest bar: 10–19 (8 people)', 'Bars touch; no gaps between them'], answer: 'Peak interval: 10–19' },
      { label: 'Box Plot', problem: 'Summary: 4, 7, 10, 14, 20.', steps: ['Whiskers: min 4 to max 20', 'Box: Q1 7 to Q3 14', 'Line inside box at median 10', 'Box holds the middle 50% of data'], answer: 'Median 10; box 7 to 14' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Each bar shows how many values are in that interval — add ALL bar heights to count total values. Second: Every section holds the same 25% of the data; a longer section means more SPREAD, not more points.'
  },
  '6.SP.B.5': {
    ccss: '6.SP.B.5', slug: '6-sp-b-5-numerical-data-summaries',
    title: 'Numerical Data Summaries', grade: '6', strand: 'SP', sheets: [30],
    explanation: [
      'Students summarize a numerical data set in context: they report the number of observations, describe the attribute measured and its units, and compute a measure of center (mean or median) together with a measure of variability — the interquartile range or the mean absolute deviation. Students relate the choice of center and spread to the shape of the distribution, using the median and IQR for skewed data and the mean and MAD for symmetric data.',
      'The anchor students hold onto: Pair a center with a spread: median with IQR (Q3 − Q1), or mean with MAD (the average absolute distance from the mean).',
      'Computing the IQR and MAD completes the 6th-grade statistics strand and prepares students to compare two populations using these summaries in 7th grade (7.SP.B.3, 7.SP.B.4).',
    ],
    examples: [
      { label: 'IQR', problem: 'Q1 = 20, Q3 = 40. Find IQR.', steps: ['IQR = Q3 − Q1', '= 40 − 20', '= 20'], answer: 'IQR = 20' },
      { label: 'MAD & Choose', problem: 'Symmetric data: 3, 5, 7, 9.', steps: ['Mean = 24 ÷ 4 = 6', 'Distances: 3, 1, 1, 3 → sum 8', 'MAD = 8 ÷ 4 = 2', 'Symmetric → mean & MAD'], answer: 'MAD = 2; use mean & MAD' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: IQR = Q3 − Q1. It measures the spread of the middle half, not the full range. Second: Outliers pull the mean. When data is skewed or has outliers, use median and IQR instead.'
  },
  '7.EE.A.1': {
    ccss: '7.EE.A.1', slug: '7-ee-a-1-like-terms-distributive',
    title: 'Combining Like Terms & the Distributive Property', grade: '7', strand: 'EE', sheets: [48, 49],
    explanation: [
      'The anchor students hold onto: Combine like terms by adding or subtracting their coefficients; the variable part stays the same. Keep unlike terms separate, and remember that x means 1x. Distribute by multiplying the outside factor by every term inside: a(b + c) = ab + ac. A negative factor flips each sign. To factor, pull out the greatest common factor: ab + ac = a(b + c).',
      'Combining like terms supports 7.EE.A.2 equivalent expressions and 7.EE.B.3–4 equations and inequalities — the first simplifying move on nearly every expression in Algebra 1.',
    ],
    examples: [
      { label: 'Same Variable', problem: 'Combine: 5x + 2x.', steps: ['Both terms have the variable part x.', 'Add the coefficients: 5 + 2 = 7.'], answer: '7x' },
      { label: 'With Subtraction', problem: 'Combine: 9y - 4y.', steps: ['Both terms have the same variable part: y.', 'Subtract the coefficients: 9 - 4 = 5.'], answer: '5y' },
      { label: 'With a Constant', problem: 'Combine: 3x + 5 + 2x.', steps: ['Like terms are 3x and 2x; the 5 is a constant.', 'Combine the x-terms: 3x + 2x = 5x; keep + 5.'], answer: '5x + 5' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Only combine same-variable terms; the 3 stays: 5x + 3. Second: x means 1x, so x + 4x = 1x + 4x = 5x.'
  },
  '7.EE.A.2': {
    ccss: '7.EE.A.2', slug: '7-ee-a-2-rewriting-expressions',
    title: 'Rewriting Expressions', grade: '7', strand: 'EE', sheets: [46],
    explanation: [
      'The anchor students hold onto: Combine like terms (same variable part), distribute the factor to every term inside parentheses, and remember that a means 1a. The rewritten form has the same value — only the form changes.',
      'Rewriting equivalent expressions supports 7.EE.B.3–4 multi-step equations and Algebra 1 simplifying. The percent-as-coefficient model (1.05a) underpins markup and growth in 7.RP.A.3.',
    ],
    examples: [
      { label: 'Like Terms', problem: 'Rewrite: 5x + 2x.', steps: ['Both terms have the same variable part: x.', 'Add the coefficients: 5 + 2 = 7.'], answer: '7x' },
      { label: 'Distribute', problem: 'Rewrite: 3(x + 4).', steps: ['Multiply 3 by each term inside.', '3 times x is 3x; 3 times 4 is 12.'], answer: '3x + 12' },
      { label: 'In Context', problem: 'Rewrite: a + 0.05a.', steps: ['a means 1a, so this is 1a + 0.05a.', 'Add the coefficients: 1 + 0.05 = 1.05.'], answer: '1.05a (a 5 percent increase)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Only combine same-variable terms. 3x and 4 are unlike. Second: Multiply the factor by EVERY term: 3(x + 4) = 3x + 12.'
  },
  '7.EE.B.3': {
    ccss: '7.EE.B.3', slug: '7-ee-b-3-multi-step-rational-problems',
    title: 'Multi-Step Rational Problems', grade: '7', strand: 'EE', sheets: [47],
    explanation: [
      'The anchor students hold onto: Set up each step in order. Use fractions, decimals, or integers in any form; convert as needed. Check that the answer is reasonable using estimation.',
      'Multi-step rational number fluency supports 7.EE.B.4 equation solving, where both sides may involve fractions or decimals, and builds toward proportional reasoning in 8th grade.',
    ],
    examples: [
      { label: 'Multi-Step Fractions', problem: 'Find: 3/4 + 2 × 1/3.', steps: ['Order of operations: multiply first. 2 × 1/3 = 2/3.', 'Add: 3/4 + 2/3. LCD = 12: 9/12 + 8/12 = 17/12.'], answer: '17/12 = 1 5/12' },
      { label: 'Decimals + Negatives', problem: '-3.5 + 2 × 1.25: what is it?', steps: ['Multiply first: 2 × 1.25 = 2.5.', 'Add: -3.5 + 2.5 = -1.'], answer: '-1' },
      { label: 'Reasonableness', problem: 'Is 1/3 of 11.7 close to 4?', steps: ['Estimate: 1/3 of 12 ≈ 4.', 'Exact: 11.7 ÷ 3 = 3.9.'], answer: 'Yes, 3.9 ≈ 4 (reasonable)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: A loss of 4.7 means adding -4.7, not +4.7. Restate: the value decreases by 4.7. Second: Regroup: 3 1/4 - 1 3/4 → rewrite 3 1/4 as 2 5/4, then subtract to get 1 2/4 = 1 1/2.'
  },
  '7.EE.B.4a': {
    ccss: '7.EE.B.4a', slug: '7-ee-b-4a-two-step-equations',
    title: 'Two-Step Equations', grade: '7', strand: 'EE', sheets: [67],
    explanation: [
      'The anchor students hold onto: Undo addition or subtraction first, then divide by the coefficient. For p(x + q) = r, distribute first or divide both sides by p. Always check by substituting your answer back.',
      'Two-step equations underlie multi-step equations, variables on both sides, and literal equations in Algebra 1. The form p(x + q) = r links the distributive property to multi-step solving.',
    ],
    examples: [
      { label: 'Standard Form', problem: 'Solve: 3x + 5 = 20.', steps: ['Subtract 5: 3x = 15.', 'Divide by 3: x = 5.', 'Check: 3(5) + 5 = 20.'], answer: 'x = 5' },
      { label: 'Distributive Form', problem: 'Solve: 2(x + 3) = 14.', steps: ['Distribute: 2x + 6 = 14.', 'Subtract 6: 2x = 8.', 'Divide by 2: x = 4.'], answer: 'x = 4' },
      { label: 'Word Problem', problem: 'Word problem: 4x + 8 = 32.', steps: ['A reader has 8 pages done and reads 4 per day.', 'She wants 32 pages total.', 'Subtract 8: 4x = 24.', 'Divide by 4: x = 6.', 'She needs 6 days.'], answer: 'x = 6 (6 days)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Undo + or - first, then divide to isolate x. Second: Multiply the factor by BOTH terms inside.'
  },
  '7.EE.B.4b': {
    ccss: '7.EE.B.4b', slug: '7-ee-b-4b-two-step-inequalities',
    title: 'Two-Step Inequalities', grade: '7', strand: 'EE', sheets: [45],
    explanation: [
      'The anchor students hold onto: Undo addition or subtraction first, then multiplication or division. Divide by a NEGATIVE — FLIP the sign. Graph: open circle for < or >; closed circle for ≤ or ≥.',
      'Two-step inequalities lead to multi-step and compound inequalities in Algebra 1 and graphing solution regions. The flip rule is foundational for linear inequalities in two variables.',
    ],
    examples: [
      { label: 'No Flip', problem: 'Solve and graph: 2x + 3 > 11.', steps: ['Subtract 3: 2x > 8.', 'Divide by 2: x > 4.', 'Graph: open circle at 4, shade right.'], answer: 'x > 4' },
      { label: 'Flip Required', problem: 'Solve and graph: -3x + 1 ≥ 10.', steps: ['Subtract 1: -3x ≥ 9.', 'Divide by -3 → FLIP the sign.', 'x ≤ -3.', 'Graph: closed circle at -3, shade left.'], answer: 'x ≤ -3' },
      { label: 'Word Problem', problem: 'Word problem: 5x + 15 ≥ 50.', steps: ['A student earns 5 pts per quiz, starts with 15 bonus pts.', 'She needs at least 50 pts total.', 'Subtract 15: 5x ≥ 35.', 'Divide by 5: x ≥ 7.', 'She needs at least 7 quizzes.'], answer: 'x ≥ 7 (at least 7 quizzes)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Divide by a negative — REVERSE the inequality sign. Second: x > n or ≥ n: shade right. x < n or ≤ n: shade left.'
  },
  '7.G.A.1': {
    ccss: '7.G.A.1', slug: '7-g-a-1-scale-drawings',
    title: 'Scale Drawings', grade: '7', strand: 'G', sheets: [42],
    explanation: [
      'At this standard, students use scale factors to find actual measurements, drawing measurements, and the scale itself.',
      'The anchor students hold onto: drawing × scale = actual. Rearrange: actual ÷ scale = drawing; actual ÷ drawing = scale.',
      'Scale factors return in 8th grade as dilations on the coordinate plane, where this same constant of proportionality maps a figure to a similar one with proportional side lengths.',
    ],
    examples: [
      { label: 'Find the Actual', problem: 'Find actual: 4×3 cm, 1 cm=2 m.', steps: ['Length: 4 cm × 2 = 8 m.', 'Width: 3 cm × 2 = 6 m.', 'Actual: 8 m × 6 m.', 'k = 200 (1:200 scale).'], answer: '8 m × 6 m' },
      { label: 'Find the Drawing', problem: 'Find drawing: 8×6 m, 1 cm=2 m.', steps: ['Length: 8 m ÷ 2 = 4 cm.', 'Width: 6 m ÷ 2 = 3 cm.', 'Drawing: 4 cm × 3 cm.', 'Same k = 200 thread.'], answer: '4 cm × 3 cm' },
      { label: 'Find the Scale', problem: 'Find scale: 4 cm → 8 m.', steps: ['Compare: 8 m ÷ 4 cm.', 'Reduce: 1 cm to 2 m.', 'Scale: 1 cm = 2 m.', 'k = 200 confirmed.'], answer: '1 cm = 2 m (k = 200)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Find sides first: 15 m × 10 m; area = 150 m². Second: Multiply: 6 × 4 = 24 m. drawing × scale = actual.'
  },
  '7.G.A.2': {
    ccss: '7.G.A.2', slug: '7-g-a-2-triangle-inequality',
    title: 'Triangle Inequality', grade: '7', strand: 'G', sheets: [44],
    explanation: [
      'The anchor students hold onto: Check ALL THREE pairs: a+b>c, a+c>b, and b+c>a. ALL must be strictly greater. Equality means a degenerate (flat) shape — not a triangle.',
      'The triangle inequality is a prerequisite for the Pythagorean theorem in 8.G.B.7 — students must confirm that given side lengths can form a valid triangle before applying the theorem.',
    ],
    examples: [
      { label: 'Can They Form a Triangle?', problem: 'Check: sides 4, 7, 5 — triangle?', steps: ['4 + 7 = 11 > 5. Pass.', '4 + 5 = 9 > 7. Pass.', '7 + 5 = 12 > 4. Pass.', 'All three pass — valid triangle.'], answer: 'Yes, these sides form a triangle.' },
      { label: 'Find the Range of the Third Side', problem: 'Given 3 and 8 — range of c?', steps: ['Lower bound: |8 - 3| = 5.', 'Upper bound: 3 + 8 = 11.', 'Range: 5 < c < 11.', 'c must be strictly between 5 and 11.'], answer: '5 < c < 11.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: All three pairs must pass — test a+b>c, a+c>b, AND b+c>a. Second: Equality means a flat, degenerate shape — the inequality must be STRICT.'
  },
  '7.G.A.3': {
    ccss: '7.G.A.3', slug: '7-g-a-3-cross-sections-of-3d-figures',
    title: 'Cross-Sections of 3D Figures', grade: '7', strand: 'G', sheets: [62],
    explanation: [
      'At this standard, students describe and identify the two-dimensional shape that results when a plane slices a three-dimensional figure, distinguishing how horizontal, vertical, and angled cuts produce different cross-sections.',
      'The anchor students hold onto: A cross-section is the 2D face exposed by a slice. Horizontal cut (parallel to base) usually matches the base shape. Vertical cut (perpendicular to base) often gives a different shape.',
      'Visualizing cross-sections builds the spatial reasoning students use in 8.G.C.9 for the volume of cylinders, cones, and spheres, and in high school geometry for solids of revolution.',
    ],
    examples: [
      { label: 'Prism, Horizontal', problem: 'Prism, horizontal slice', steps: ['A right rectangular prism is cut parallel to its base.', 'The slice exposes a face the same shape as the base.', 'The base is a rectangle, so the cross-section is a rectangle.'], answer: 'Rectangle' },
      { label: 'Pyramid, Vertical', problem: 'Pyramid, vertical slice', steps: ['A rectangular pyramid is cut down through its apex.', 'The slice runs from the top point to the base.', 'It exposes a triangle: point on top, base below.'], answer: 'Triangle' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The cut DIRECTION matters. A vertical slice of a cylinder is a rectangle, not a circle. A vertical slice of a rectangular pyramid is a triangle, not a rectangle. Always check horizontal vs vertical first. Second: A cross-section is always a flat 2D shape: rectangle, triangle, circle, square, or trapezoid. Never answer "cylinder" or "pyramid" — those are the solids, not the slices.'
  },
  '7.G.B.4': {
    ccss: '7.G.B.4', slug: '7-g-b-4-circumference-area-of-circles',
    title: 'Circumference & Area of Circles', grade: '7', strand: 'G', sheets: [61],
    explanation: [
      'At this standard, students apply the formulas for circumference (C=πd or C=2πr) and area (A=πr²) of a circle to solve real-world and mathematical problems, and identify common formula-application errors.',
      'The anchor students hold onto: Circumference: C=πd or C=2πr (distance around). Area: A=πr² (space inside). Always use radius in the area formula. If given d, find r=d/2 first.',
      'Circle formulas for circumference and area are foundational for 8.G.C.9, where students find surface area and volume of cylinders, cones, and spheres.',
    ],
    examples: [
      { label: 'Circumference', problem: 'd=8 cm, find C', steps: ['Choose formula: C=πd.', 'Substitute: C=π(8).', 'Calculate: C=3.14(8)=25.12 cm.'], answer: 'C=25.12 cm' },
      { label: 'Area', problem: 'r=5 cm, find A', steps: ['Choose formula: A=πr².', 'Substitute: A=π(5²)=π(25).', 'Calculate: A=3.14(25)=78.5 cm².'], answer: 'A=78.5 cm²' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The area formula A=πr² requires the RADIUS. For d=10, find r=5 first: A=π(5²)=π(25)=78.5, not π(100)=314. Using d gives an area 4 times too large. Second: The area formula has an EXPONENT: A=πr². Circumference is C=πd or C=2πr. Area has r SQUARED. Write both formulas on your reference card and check which you need.'
  },
  '7.G.B.5': {
    ccss: '7.G.B.5', slug: '7-g-b-5-angle-relationships',
    title: 'Angle Relationships', grade: '7', strand: 'G', sheets: [43],
    explanation: [
      'The anchor students hold onto: Vertical angles are EQUAL. Linear pair SUMS TO 180°. Complementary SUMS TO 90°. Identify the relationship, write the equation, solve for the unknown.',
      'Students need this skill to work with parallel lines cut by a transversal in 8.G.A.5, where vertical and supplementary relationships generalize to corresponding and alternate angle pairs.',
    ],
    examples: [
      { label: 'Vertical Angles', problem: 'Vertical: ∠1=30°. Find ∠3.', steps: ['Vertical angles are EQUAL.', '∠3 and ∠1 are vertical at O.', '∠3 = ∠1 = 30°.'], answer: '∠3 = 30°.' },
      { label: 'Linear Pair', problem: 'Linear pair: ∠1=30°. Find ∠2.', steps: ['Linear pair SUMS TO 180°.', '∠1 + ∠2 = 180°.', '30° + ∠2 = 180°.', '∠2 = 150°.'], answer: '∠2 = 150°.' },
      { label: 'Complementary', problem: 'OE⊥AB: ∠BOC=30°. Find ∠COE.', steps: ['∠BOE = 90° (right angle).', '∠BOC + x = 90°.', '30° + x = 90°.', 'x = 60°.'], answer: 'x = 60° (∠COE).' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Complementary = 90° (right angle). Supplementary = 180° (straight line). Identify the figure first. Second: Linear pair angles are on the same straight line — write the SUM equation: ∠1 + ∠2 = 180°.'
  },
  '7.G.B.6': {
    ccss: '7.G.B.6', slug: '7-g-b-6-composite-area-volume-surface-area',
    title: 'Composite Area, Volume & Surface Area', grade: '7', strand: 'G', sheets: [63],
    explanation: [
      'At this standard, students find the area of composite two-dimensional figures by decomposition, and the volume and surface area of solids built from right prisms, by breaking each figure into familiar shapes and combining the parts.',
      'The anchor students hold onto: Decompose into shapes you know, find each part, then ADD. Subtract any removed region. For volume, add the prism volumes; for surface area, add only the faces that are exposed.',
      'Decomposing composite figures prepares students for 8.G.C.9, the volume of cylinders, cones, and spheres, and the area and volume reasoning used throughout high school geometry.',
    ],
    examples: [
      { label: 'L-Shape Area', problem: 'L-shape: 8 by 6, notch 4 by 3', steps: ['Split the L into two rectangles.', 'Bottom rectangle: 8 x 3 = 24 square units.', 'Top rectangle: 4 x 3 = 12 square units.', 'Add: 24 + 12 = 36 square units.'], answer: '36 square units.' },
      { label: 'Prism Volume', problem: 'Two stacked boxes, find volume', steps: ['Volume of a prism = base area x height.', 'Lower box: 5 x 3 x 2 = 30 cubic units.', 'Upper box: 5 x 3 x 4 = 60 cubic units.', 'Add: 30 + 60 = 90 cubic units.'], answer: '90 cubic units.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Area is not perimeter. Decompose the figure into rectangles and triangles, use A = l x w and A = 1/2 b h on each piece, then add the AREAS together. Second: Where two solids meet, the touching faces are hidden and are NOT part of the surface area. Count only the faces you could see or touch from the outside.'
  },
  '7.NS.A.1a': {
    ccss: '7.NS.A.1a', slug: '7-ns-a-1a-additive-inverse-opposites',
    title: 'Additive Inverse & Opposites', grade: '7', strand: 'NS', sheets: [53],
    explanation: [
      'The anchor students hold onto: The additive inverse of any number a is −a. A number and its additive inverse are always the same distance from 0 on opposite sides of the number line, and their sum is always 0.',
      'You now know that a number and its opposite always sum to 0. The additive inverse is the key idea that makes integer addition with different signs work — next in the 7.NS.A.1 strand.',
    ],
    examples: [
      { label: 'Integers', problem: 'Find: additive inverse of −7.', steps: ['−7 is 7 units to the left of 0 on the number line.', 'Its opposite is +7 — same distance from 0, opposite side.', '(−7) + 7 = 0. The additive inverse of −7 is 7.'], answer: 'The additive inverse of −7 is 7.' },
      { label: 'Special Cases', problem: 'Find: additive inverse of 0.', steps: ['0 is at the origin of the number line.', '0 is equidistant from both sides — its own opposite.', '0 + 0 = 0. The additive inverse of 0 is 0.'], answer: 'The additive inverse of 0 is 0.' },
      { label: 'Real-World Context', problem: 'Temperature: −12 and +12.', steps: ['−12 and +12 are opposites: both 12 units from 0, on opposite sides.', '−12 is the additive inverse of +12 (and vice versa).', '(−12) + 12 = 0. Opposite temperatures combine to make 0.'], answer: '(−12) + 12 = 0; opposite quantities combine to make 0.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The additive inverse changes the sign. The additive inverse of −8 is +8, not −8, because (−8) + 8 = 0. Verify: if the sum is not 0, the inverse is wrong. Second: Additive inverses must sum to 0. (−3) + (−3) = −6, not 0. The additive inverse of −3 is +3, because (−3) + 3 = 0. Opposite signs, same distance from 0.'
  },
  '7.NS.A.1b': {
    ccss: '7.NS.A.1b', slug: '7-ns-a-1b-adding-integers',
    title: 'Adding Integers', grade: '7', strand: 'NS', sheets: [33],
    explanation: [
      'Students add integers with the same and different signs using absolute value reasoning (SUMS) and the number-line jump model, recognize that opposites sum to zero, and apply properties of operations as strategies for multi-addend sums in real-world contexts.',
      'The anchor students hold onto: SUMS: Same signs add · Unlike signs subtract · Magnitude keeps the sign · Sum of opposites is 0.',
      'Where this leads next, students will subtract integers by rewriting each difference as adding the opposite — the same number-line and sign reasoning you used here carries straight over to that skill.',
    ],
    examples: [
      { label: 'Same Signs', problem: '−4 + (−9)', steps: ['Same signs (both −)', 'Add: 4 + 9 = 13', 'Keep the sign: −', 'A: −13'], answer: '−13' },
      { label: 'Unlike Signs', problem: '−12 + 5', steps: ['Unlike signs', 'Subtract: 12 − 5 = 7', '|−12| > |5| → negative', 'A: −7'], answer: '−7' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Unlike signs subtract: 9−5=4; |−9|>|5| gives −4 Second: |−11| > |4|, so the answer must be negative: −11 + 4 = −7'
  },
  '7.NS.A.1c': {
    ccss: '7.NS.A.1c', slug: '7-ns-a-1c-subtracting-integers',
    title: 'Subtracting Integers', grade: '7', strand: 'NS', sheets: [34],
    explanation: [
      'Students subtract integers by rewriting every difference as adding the additive inverse (Keep–Change–Change), model the rewritten sum as a jump on the number line, and interpret the distance between two integers as the absolute value of their difference in real-world contexts.',
      'The anchor students hold onto: KCC: Keep the first number · Change subtraction to addition · Change the sign of the second — then use SUMS.',
      'Where this leads next, students will multiply integers, where the sign rules tighten into one pattern: same signs give a positive product, different signs give a negative one — fluency here makes that automatic.',
    ],
    examples: [
      { label: 'Subtract a Positive', problem: '5 − 8', steps: ['KCC: 5 + (−8)', 'Unlike signs: 8 − 5 = 3', '|−8| > |5| → negative', 'A: −3'], answer: '−3' },
      { label: 'Subtract a Negative', problem: '3 − (−5)', steps: ['KCC: 3 + (+5)', 'Same signs: add', '3 + 5 = 8', 'A: 8'], answer: '8' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Add the opposite — (−6) + 4 = −2 (Keep, Change, Change) Second: Change BOTH: 7 + 5 = 12 — keep, change, change.'
  },
  '7.NS.A.1d': {
    ccss: '7.NS.A.1d', slug: '7-ns-a-1d-adding-subtracting-rationals',
    title: 'Adding & Subtracting Rationals', grade: '7', strand: 'NS', sheets: [37],
    explanation: [
      'Students add and subtract positive and negative fractions, mixed numbers, and decimals by rewriting every subtraction as adding the additive inverse (Keep–Change–Change), applying the SUMS sign rules over a common denominator, representing sums and differences as jumps on the number line, and interpreting results in real-world contexts.',
      'The anchor students hold onto: See subtraction? KCC it: Keep the first number · Change − to + · Change the second sign. Then SUMS finishes — fractions get a common denominator first.',
    ],
    examples: [
      { label: 'Unlike Denominators', problem: '(,[object Object],) + ,[object Object]', steps: ['LCD = 4: 1/2 = 2/4', 'Signs differ → 3/4 − 2/4 = 1/4', 'Larger value is negative → −1/4', 'A: −1/4'], answer: '−1/4' },
      { label: 'KCC a Subtraction', problem: '[object Object], − ,[object Object]', steps: ['KCC: 2/5 + (−4/5)', 'Signs differ → 4/5 − 2/5 = 2/5', 'Larger value is negative → −2/5', 'A: −2/5'], answer: '−2/5' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Denominators never add — find the LCD first: 3/12 + 8/12 = 11/12 Second: KCC changes BOTH signs: 3/5 + 1/5 = 4/5 — subtracting a negative ADDS'
  },
  '7.NS.A.2a': {
    ccss: '7.NS.A.2a', slug: '7-ns-a-2a-multiplying-integers',
    title: 'Multiplying Integers', grade: '7', strand: 'NS', sheets: [35],
    explanation: [
      'Students multiply integers by multiplying absolute values and applying the sign rules (same signs positive, different signs negative), model a positive count of negative groups as repeated jumps on the number line, justify why a negative times a negative is positive using number patterns, and interpret integer products in real-world contexts.',
      'The anchor students hold onto: MAPS: Multiply the absolute values · Ask if the signs match · Positive if same · Switch to negative if different.',
      'Where this leads next, students will divide integers using the very same sign rules you applied to multiplication, then extend both operations to all rational numbers across the rest of the strand.',
    ],
    examples: [
      { label: 'Different Signs', problem: '(−3) × 4', steps: ['3 × 4 = 12', 'Signs differ → negative', 'Four jumps of −3 → −12', 'A: −12'], answer: '−12' },
      { label: 'Same Signs', problem: '(−6) × (−4)', steps: ['6 × 4 = 24', 'Same signs → positive', 'A: 24'], answer: '24' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Same signs ALWAYS give a positive product: (−3) × (−7) = +21 Second: The ADDITION rule — products only ask if signs match: −28'
  },
  '7.NS.A.2b': {
    ccss: '7.NS.A.2b', slug: '7-ns-a-2b-dividing-integers',
    title: 'Dividing Integers', grade: '7', strand: 'NS', sheets: [36],
    explanation: [
      'Students divide integers by dividing absolute values and applying the sign rules (same signs positive, different signs negative), connect every quotient to its related multiplication fact, explain why a quotient of integers exists whenever the divisor is not zero and why division by zero is undefined, and interpret integer quotients in real-world contexts.',
      'The anchor students hold onto: MAPS works for division too: Multiply or DIVIDE the absolute values · Ask if the signs match · Positive if same · Switch to negative if different.',
    ],
    examples: [
      { label: 'Different Signs', problem: '(−42) ÷ 6', steps: ['42 ÷ 6 = 7', 'Signs differ → negative', 'Check: (−7) × 6 = −42', 'A: −7'], answer: '−7' },
      { label: 'Same Signs', problem: '(−24) ÷ (−8)', steps: ['24 ÷ 8 = 3', 'Same signs → positive', 'A: 3'], answer: '3' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Same signs ALWAYS give a positive quotient: (−42) ÷ (−6) = +7 Second: 0 ÷ 9 = 0, but 9 ÷ 0 is UNDEFINED — no number times 0 makes 9'
  },
  '7.NS.A.2c': {
    ccss: '7.NS.A.2c', slug: '7-ns-a-2c-multiplying-dividing-rationals',
    title: 'Multiplying & Dividing Rationals', grade: '7', strand: 'NS', sheets: [38],
    explanation: [
      'Students multiply positive and negative fractions, mixed numbers, and decimals by multiplying absolute values and applying the sign rules, divide rational numbers by rewriting every quotient as multiplication by the reciprocal (Keep–Change–Flip), explain why a quotient of integers with a nonzero divisor is a rational number and why the divisor can never be zero, and interpret products and quotients in real-world contexts.',
      'The anchor students hold onto: MAPS still rules the signs: Multiply or DIVIDE the absolute values · Ask if the signs match · Positive if same · Switch to negative if different. See division? KCF it first.',
    ],
    examples: [
      { label: 'Multiply Straight Across', problem: '(,[object Object],) × ,[object Object]', steps: ['Multiply across: 2×3 = 6, 3×5 = 15', 'Signs differ → negative', '−6/15 = −2/5', 'A: −2/5'], answer: '−2/5' },
      { label: 'KCF a Division', problem: '(,[object Object],) ÷ ,[object Object]', steps: ['KCF: (−5/6) × (12/5)', 'Multiply across: 60/30 = 2', 'Signs differ → negative', 'A: −2'], answer: '−2' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Convert first: 2 1/2 = 5/2, so 5/2 × 3 = 15/2 = 7 1/2 Second: KEEP the first — FLIP the divisor: (1/2) × (4/3) = 2/3'
  },
  '7.NS.A.2d': {
    ccss: '7.NS.A.2d', slug: '7-ns-a-2d-terminating-vs-repeating-decimals',
    title: 'Terminating vs Repeating Decimals', grade: '7', strand: 'NS', sheets: [54],
    explanation: [
      'Students convert rational numbers to decimal form using long division, recognize that the decimal form of a rational number either terminates in zeros or eventually repeats, record repeating decimals with bar notation, and move fluently among fraction, decimal, and percent names for the same value in numeric and real-world settings.',
      'The anchor students hold onto: DIVIDE to turn a fraction into a decimal: numerator ÷ denominator. CLASSIFY the result — it always terminates or repeats; a bar marks the repeating digits. SHIFT the point two places right for a percent.',
    ],
    examples: [
      { label: 'Terminating Decimal', problem: '[object Object], → decimal → percent', steps: ['Divide: 3 ÷ 8 = 0.375', 'The division ends — terminating', 'Shift two right: 0.375 = 37.5%', 'A: 0.375 = 37.5%'], answer: '0.375 = 37.5%' },
      { label: 'Repeating Decimal', problem: '[object Object], → decimal (bar notation)', steps: ['Divide: 5 ÷ 6 = 0.8333…', 'The 3 never stops — repeating', 'Write a bar over the repeating 3', 'A: 0.83 with a bar over the 3'], answer: '0.833… — bar over the 3' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Percent means per 100 — shift TWO places: 0.45 = 45% Second: 1 ÷ 3 never ends — bar the repeat: 0.333…'
  },
  '7.NS.A.3': {
    ccss: '7.NS.A.3', slug: '7-ns-a-3-real-world-rational-number-problems',
    title: 'Real-World Rational Number Problems', grade: '7', strand: 'NS', sheets: [55],
    explanation: [
      'The anchor students hold onto: Read the context, select the operation(s), and compute with rational numbers. A negative or fractional result can be correct — always interpret the answer in the context of the problem.',
      'All four rational number operations feed directly into proportional reasoning, multi-step equations, and geometry — nearly every 7th-grade strand builds on this computational foundation.',
    ],
    examples: [
      { label: 'Compute', problem: 'Temp: 2.5°F, drops 8.75°F.', steps: ['Temperature drops → select subtraction: 2.5 − 8.75.', '2.50 − 8.75 = −6.25 (borrow; negative because drop is larger).', 'Answer: −6.25°F. Negative result = below zero ✓'], answer: 'Final temperature: −6.25°F.' },
      { label: 'Multi-Step', problem: 'Lawn: $9/hr × 3.5 hr − $5.50.', steps: ['Step 1 — Multiply: $9 × 3.5 = $31.50 earned.', 'Step 2 — Subtract: $31.50 − $5.50 = $26.00.', 'Net earnings: $26.00 ✓'], answer: 'Net earnings: $26.00.' },
      { label: 'Assess', problem: 'Bill: $36.75 ÷ 3 people. Each?', steps: ['Estimate first: $36 ÷ 3 ≈ $12 per person.', 'Compute: $36.75 ÷ 3 = $12.25 per person.', 'Close to estimate → result is reasonable ✓'], answer: '$12.25 per person.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Rate × time = total distance or total amount. "Per hour for 2 hours" signals multiplication. Verify: 3/4 × 2 2/3 = 2 miles, not 3/4 + 2 2/3 = 3 5/12 miles. Second: A negative answer is correct when the situation calls for it: a drop below zero, a debt, a descent. Always connect the sign back to the context before writing the final answer.'
  },
  '7.RP.A.1': {
    ccss: '7.RP.A.1', slug: '7-rp-a-1-unit-rates',
    title: 'Unit Rates', grade: '7', strand: 'RP', sheets: [39],
    explanation: [
      'The anchor students hold onto: Divide the first quantity by the second so the second becomes 1, then label the unit. To divide by a fraction, multiply by its reciprocal. To compare, find each unit rate.',
      'A unit rate is the slope of a proportional relationship: the amount per one unit is exactly the constant of proportionality k in y = kx, which leads directly into 7.RP.A.2.',
    ],
    examples: [
      { label: 'Whole-Number Rate', problem: '180 miles in 4 hours: mph?', steps: ['Set up the rate: 180 miles over 4 hours.', 'Divide: 180 ÷ 4 = 45.'], answer: '45 miles per hour' },
      { label: 'Fraction Ratio', problem: '1/2 mile in 1/4 hour: mph?', steps: ['Divide the fractions: 1/2 ÷ 1/4.', 'Multiply by the reciprocal: 1/2 × 4 = 2.'], answer: '2 miles per hour' },
      { label: 'Compare Rates', problem: '60 mi/3 hr vs 80 mi/5 hr?', steps: ['First rate: 60 ÷ 3 = 20.', 'Second rate: 80 ÷ 5 = 16.'], answer: 'First is faster (20 > 16)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Divide first ÷ second: 180 miles ÷ 4 hours = 45 mph, not 4 ÷ 180. Second: Divide all the way: 180:4 becomes 45:1, so the unit rate is 45.'
  },
  '7.RP.A.2': {
    ccss: '7.RP.A.2', slug: '7-rp-a-2-constant-of-proportionality',
    title: 'Constant of Proportionality', grade: '7', strand: 'RP', sheets: [40],
    explanation: [
      'Students identify the constant of proportionality k from tables, graphs, equations, and verbal descriptions, represent proportional relationships with equations of the form y = kx, and interpret points on the graph of a proportional relationship in terms of the situation, including the meaning of the points (0, 0) and (1, k).',
      'The anchor students hold onto: RATIO: divide y by x for each pair. CONSTANT: that shared value is k. EQUATION: write y = kx. INTERPRET: the graph passes through (0, 0), and the point (1, k) shows the constant.',
      'The constant k is the unit rate for one x. Next you apply proportional reasoning to percent problems in 7.RP.A.3, and in 8th grade this same k becomes the slope of a line.',
    ],
    examples: [
      { label: 'Find k from a Table', problem: 'Find k: (2, 6), (4, 12), (5, 15)', steps: ['Ratio: 6 ÷ 2 = 3, 12 ÷ 4 = 3, 15 ÷ 5 = 3', 'Same ratio every pair — k = 3', 'Equation: y = 3x', 'A: k = 3, y = 3x'], answer: 'k = 3, y = 3x' },
      { label: 'Find k from Words', problem: 'A plant grows 5 cm every 2 days', steps: ['Ratio: k = y ÷ x = 5 ÷ 2 = 2.5', 'Constant: 2.5 cm of growth per day', 'Equation: y = 2.5x', 'A: k = 2.5, y = 2.5x'], answer: 'k = 2.5, y = 2.5x' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: k = y ÷ x — divide the y-value by the x-value Second: Proportions multiply: y is always k times x'
  },
  '7.RP.A.3': {
    ccss: '7.RP.A.3', slug: '7-rp-a-3-percent-problems',
    title: 'Percent Problems', grade: '7', strand: 'RP', sheets: [41],
    explanation: [
      'The anchor students hold onto: Change the percent to a decimal, then multiply by the whole. For an increase multiply by 1 plus the rate; for a decrease, 1 minus the rate. Percent change divides by the ORIGINAL amount.',
      'The new amount = whole times (1 plus or minus the rate) idea becomes percent-as-coefficient work in 7.EE.A.2, and percent reasoning carries forward into consumer math and scaling.',
    ],
    examples: [
      { label: 'Percent Of', problem: 'Find 30% of 80.', steps: ['Change the percent to a decimal: 30% = 0.30.', 'Multiply by the whole: 0.30 × 80 = 24.'], answer: '24' },
      { label: 'Increase', problem: 'Increase 50 by 20%.', steps: ['A 20 percent increase multiplies by 1.20.', '50 × 1.20 = 60.'], answer: '60' },
      { label: 'Percent Change', problem: 'From 40 to 50: % change?', steps: ['Find the change: 50 - 40 = 10.', 'Divide by the original: 10 ÷ 40 = 0.25.'], answer: '25% increase' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Convert first: 25% = 0.25, then 0.25 × 80 = 20. Second: Increase means original + change, or just × (1 + rate).'
  },
  '7.SP.A.1': {
    ccss: '7.SP.A.1', slug: '7-sp-a-1-random-sampling',
    title: 'Random Sampling', grade: '7', strand: 'SP', sheets: [57],
    explanation: [
      'At this standard, students identify populations and samples, classify samples as random or biased, and evaluate whether inferences about a population are valid based on the sampling method used.',
      'The anchor students hold onto: A random sample gives every member of a population an equal chance of being selected; random samples tend to be representative, making inferences about the population valid.',
      'A valid random sample makes your inferences reliable — in 7.SP.A.2, you will use random sample data to draw inferences and make predictions about an entire population.',
    ],
    examples: [
      { label: 'Identify Population and Sample', problem: 'Lottery draw — 50 of 300 names.', steps: ['Population: all 300 students in the school.', '50 names drawn at random from a hat = the sample.', 'Every student had an equal chance of selection.'], answer: 'Population: all 300 students; Sample: 50 drawn' },
      { label: 'Random or Biased?', problem: 'First 20 at school dance.', steps: ['Early arrivers volunteered — not random selection.', 'This is a convenience sample (biased).', 'Inference about all students: NOT valid.'], answer: 'Biased — not a valid inference' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Reliability depends on random selection, not just size. A large biased sample is still biased. Second: Only a random sample — where every member had an equal chance of selection — supports valid inferences.'
  },
  '7.SP.A.2': {
    ccss: '7.SP.A.2', slug: '7-sp-a-2-inferences-from-random-samples',
    title: 'Inferences from Random Samples', grade: '7', strand: 'SP', sheets: [58],
    explanation: [
      'At this standard, students use sample data to calculate statistics, draw inferences about a population, and use multiple samples to evaluate the variability and reliability of those inferences.',
      'The anchor students hold onto: Use sample data to estimate a population characteristic — but remember that different samples give different estimates, so inferences are predictions, not exact values.',
      'Drawing inferences from one population sets the stage for 7.SP.B.3 and B.4, where students compare two populations using measures of center and variability to evaluate differences.',
    ],
    examples: [
      { label: 'Calculate Sample Mean', problem: 'Scores: 80, 75, 90, 85, 70.', steps: ['Sum = 80 + 75 + 90 + 85 + 70 = 400.', 'Mean = 400 / 5 = 80.', 'Inference: we estimate the class average is about 80.'], answer: 'Sample mean = 80; we estimate the class average is about 80' },
      { label: 'Inference from Proportion', problem: '6 of 20 sampled prefer biking.', steps: ['6/20 = 30% prefer biking in the sample.', 'Population = 500 students.', '30% of 500: 0.30 x 500 = 150 students.'], answer: 'Estimate about 150 of 500 students prefer biking' },
      { label: 'Compare Two Samples', problem: 'A mean = 42. B mean = 38.', steps: ['Sample A range: 4. Sample B range: 18.', 'Both estimate the population mean near 40.', 'Sample A is more reliable — less variability.'], answer: 'Both infer mean is near 40; Sample A more reliable (less spread)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The sample mean estimates the population mean. Different samples give different means — the true population mean may vary slightly from any single sample. Second: Variability across samples is normal and expected. Average multiple sample means for the best estimate of the population.'
  },
  '7.SP.B.3': {
    ccss: '7.SP.B.3', slug: '7-sp-b-3-comparing-populations-informally',
    title: 'Comparing Populations Informally', grade: '7', strand: 'SP', sheets: [59],
    explanation: [
      'At this standard, students compare two numerical data distributions by describing the degree of visual overlap and by expressing the center difference as a multiple of the MAD.',
      'The anchor students hold onto: To compare distributions: find the center gap, then divide by the MAD. A ratio of 1 or less means much overlap. A ratio of 2 or more means the groups are clearly separated.',
      'Expressing center differences as MAD multiples leads to 7.SP.B.4, where students use center and variability measures to draw formal comparative inferences about two populations.',
    ],
    examples: [
      { label: 'Describe Visual Overlap', problem: 'A: 4,5,7,9,10 B: 5,6,8,10,11', steps: ['A range: 4 to 10. B range: 5 to 11.', 'Shared range: 5 to 10 — both sets have values here.', 'Overlap level: much overlap (centers only 1 apart).'], answer: 'Much overlap — A (4-10) and B (5-11) share nearly the same range' },
      { label: 'Find the MAD', problem: 'A: 4, 5, 7, 9, 10 (mean = 7)', steps: ['Deviations: |4-7|=3, |5-7|=2, |7-7|=0, |9-7|=2, |10-7|=3.', 'Sum of deviations = 3+2+0+2+3 = 10.', 'MAD = 10/5 = 2.'], answer: 'MAD = 10/5 = 2' },
      { label: 'Express Gap in MADs', problem: 'A mean=7, B mean=13, MAD=2.', steps: ['Center gap = 13 - 7 = 6.', 'MADs apart = 6 / 2 = 3.', 'The centers are 3 MADs apart — little overlap.'], answer: '6 / 2 = 3 MADs apart; little visual overlap' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The center gap must be measured in MAD units. A gap of 10 points means little if MAD is also 10, but signals clear separation if MAD is only 2. Always divide the center gap by the MAD. Second: Distributions can overlap visually yet still have very different centers. Always report BOTH the visual overlap description AND the MAD ratio for a complete comparison.'
  },
  '7.SP.B.4': {
    ccss: '7.SP.B.4', slug: '7-sp-b-4-comparing-populations-numerically',
    title: 'Comparing Populations Numerically', grade: '7', strand: 'SP', sheets: [60],
    explanation: [
      'At this standard, students use measures of center and variability from random sample data to draw informal comparative inferences about two populations, using precise inference language.',
      'The anchor students hold onto: Find center and spread for each sample. Express the center gap in MAD units. Then use both statistics together to draw an inference about which population is typically higher.',
      'Informal comparative inference with center and variability prepares students for 8.SP.A.1, where scatter plots and lines of best fit support predictions about bivariate data.',
    ],
    examples: [
      { label: 'MAD Ratio + Inference', problem: 'mean A=20, B=26, MAD=3 each', steps: ['Center gap = 26 − 20 = 6.', 'MAD ratio = 6 / 3 = 2 MADs apart → little overlap.', 'Population B is typically higher (based on samples).'], answer: '6/3 = 2 MADs apart; little overlap; Population B is typically higher' },
      { label: 'Write Full Inference', problem: 'A mean=40, B mean=52; 3 MADs', steps: ['3 MADs apart: clearly different; little to no overlap.', 'Population B has the higher center (mean=52 vs. 40).', '"Based on samples, Population B is typically higher than A."'], answer: 'Population B is typically higher (3 MADs; clearly different)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: An informal comparative inference says one population is TYPICALLY higher — not always. Overlapping distributions mean some members of the lower-center group may still score above members of the higher-center group. Use "typically" or "tends to be," never "always." Second: Both center AND variability are required. A center gap of 6 means very different things when MAD=2 (3 MADs — clearly different) vs. MAD=12 (0.5 MADs — much overlap). Always express the center gap in MAD units before drawing an inference.'
  },
  '7.SP.C.5': {
    ccss: '7.SP.C.5', slug: '7-sp-c-5-probability-scale-0-to-1',
    title: 'Probability Scale 0 to 1', grade: '7', strand: 'SP', sheets: [56],
    explanation: [
      'The anchor students hold onto: Every probability is from 0 to 1. Near 0 = unlikely, about 1/2 = equally likely, near 1 = likely. Same value: 1/2 = 0.5 = 50%.',
      'The 0-to-1 scale grounds #50 experimental and theoretical probability, where students compute the exact probabilities they here estimate and place on the likelihood line.',
    ],
    examples: [
      { label: 'Place It', problem: 'Place P = 1/4 on the scale.', steps: ['1/4 = 0.25, which is between 0 and 1/2.', 'It sits left of the middle, so the event is unlikely.'], answer: '0.25 — unlikely' },
      { label: 'Describe It', problem: 'Describe P(event) = 0.9.', steps: ['0.9 is very close to 1.', 'An event near 1 is likely (almost certain).'], answer: 'likely' },
      { label: 'Same Value', problem: 'Match: 1/2, 0.5, 50%.', steps: ['All three name the same point on the scale.', 'That point is the middle: equally likely.'], answer: 'all equally likely' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Compare each probability to the whole. Convert to decimals or a common form: 1/2 = 0.5 is greater than 2/5 = 0.4. Second: P = 0 means the event truly cannot happen, and no probability is ever above 1. Any value outside 0 to 1 is an error.'
  },
  '7.SP.C.6': {
    ccss: '7.SP.C.6', slug: '7-sp-c-6-experimental-theoretical-probability',
    title: 'Experimental & Theoretical Probability', grade: '7', strand: 'SP', sheets: [50],
    explanation: [
      'The anchor students hold onto: Experimental: P = favorable trials / total trials. Theoretical: P = favorable outcomes / total outcomes. More trials moves experimental probability closer to theoretical.',
      'Understanding long-run relative frequency leads directly into 7.SP.C.7 probability models, where theoretical probability is used to build and evaluate models of chance.',
    ],
    examples: [
      { label: 'Experimental Probability', problem: 'Red spun 14 out of 40 times.', steps: ['Identify favorable outcomes: 14 reds from the data.', 'Total trials: 40 spins.', 'P(red) = 14/40. Simplify: 7/20.'], answer: 'P(red) = 7/20' },
      { label: 'Theoretical Probability', problem: 'Bag: 3 red, 12 total marbles.', steps: ['Sample space: 12 equally likely outcomes.', 'Favorable outcomes: 3 red marbles.', 'P(red) = 3/12 = 1/4.'], answer: 'P(red) = 1/4' },
      { label: 'Predicting Outcomes', problem: 'P(red) = 1/4; 80 spins total.', steps: ['Use: expected = P × total trials.', 'Substitute: 1/4 × 80 = 20.'], answer: 'About 20 red results' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The denominator must be the TOTAL — all trials or all possible outcomes, not just the ones that did not occur. Second: Experimental probability reads from the actual data: count favorable trials and divide by total trials, regardless of the theoretical value.'
  },
  '7.SP.C.7': {
    ccss: '7.SP.C.7', slug: '7-sp-c-7-probability-models',
    title: 'Probability Models', grade: '7', strand: 'SP', sheets: [51],
    explanation: [
      'The anchor students hold onto: Uniform model: P = 1 / total outcomes for each outcome. Non-uniform model: P = observed frequency / total observations. In all models, the probabilities of every outcome must sum to 1.',
      'You have modeled probability for individual events. Next, you will calculate probabilities for compound events — two or more outcomes combined — using lists, tables, and tree diagrams.',
    ],
    examples: [
      { label: 'Uniform Probability Model', problem: 'Spinner: 8 sections, 2 red.', steps: ['Sample space: 8 equal sections.', 'Uniform model: each section has P = 1/8.', 'Favorable: 2 red. P(red) = 2/8 = 1/4.'], answer: 'P(red) = 1/4' },
      { label: 'Non-Uniform Model', problem: '20 spins: A=12, B=8.', steps: ['Total observations: 20 spins.', 'Assign: P(A) = 12/20 = 3/5. P(B) = 8/20 = 2/5.', 'Verify: 3/5 + 2/5 = 5/5 = 1. Valid model.'], answer: 'P(A) = 3/5, P(B) = 2/5' },
      { label: 'Compare & Explain', problem: 'Model P(A)=1/3; 9 of 24 spins.', steps: ['Model predicts: 1/3 × 24 = 8 expected.', 'Observed: 9 of 24 spins on A.', 'Compare: 9 vs. 8. Close — variation normal in small samples.'], answer: 'Expected: 8 · Observed: 9 · Variation expected.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Check whether the problem provides a uniform model (equal sections, fair coin/die) or observed data. If data is given, build a non-uniform model: P = frequency / total for each outcome. Second: A valid probability must be between 0 and 1. Divide each count by the total number of observations to find relative frequency, then use that as the probability.'
  },
  '7.SP.C.8': {
    ccss: '7.SP.C.8', slug: '7-sp-c-8-compound-events',
    title: 'Compound Events', grade: '7', strand: 'SP', sheets: [52],
    explanation: [
      'The anchor students hold onto: A compound event occurs when two or more simple events happen together. P(compound event) = number of favorable outcomes / total outcomes in the sample space.',
      'You can now find probabilities for compound events by building sample spaces. This thinking connects to statistical reasoning and simulation — tools you will use in 8th grade data analysis.',
    ],
    examples: [
      { label: 'Organized List', problem: 'Flip a coin and roll 1-3.', steps: ['Sample space: (H,1)(H,2)(H,3)(T,1)(T,2)(T,3) — 6 outcomes.', 'Favorable (H and 2): 1 outcome.', 'P(heads and 2) = 1/6.'], answer: 'P(heads and 2) = 1/6' },
      { label: 'Tree Diagram', problem: 'Spinner (R/B) and coin flip.', steps: ['Tree: (R,H)(R,T)(B,H)(B,T) — 4 outcomes.', 'Favorable (Red and Heads): 1 outcome.', 'P(Red and Heads) = 1/4.'], answer: 'P(Red and Heads) = 1/4' },
      { label: 'Without Replacement', problem: 'Pick 2 tiles; no replacement.', steps: ['Bag: Red, Blue, Yellow. Draw 2 without replacing.', 'Outcomes: (R,B)(R,Y)(B,R)(B,Y)(Y,R)(Y,B) — 6 total.', 'P(Red, then Blue) = 1/6.'], answer: 'P(Red then Blue) = 1/6' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Systematically list every combination: pair each first-event outcome with every second-event outcome. Total outcomes = (# first outcomes) x (# second outcomes). Count all paths before computing P. Second: When items are drawn without replacement, reduce the available outcomes for the second draw by 1. List the new sample space: fewer outcomes are available after the first item is removed.'
  },
  '8.EE.A.1': {
    ccss: '8.EE.A.1', slug: '8-ee-a-1-exponent-rules',
    title: 'Exponent Rules', grade: '8', strand: 'EE', sheets: [71, 72],
    explanation: [
      'At this standard, students simplify expressions with same-base powers by applying the product, quotient, power-of-a-power, and power-of-a-product rules — operating on the exponents while keeping the base unchanged — and will name the rule used in each step.',
      'The anchor students hold onto: Same base, four moves: PRODUCT adds the exponents; QUOTIENT subtracts them; POWER OF A POWER multiplies them; POWER OF A PRODUCT distributes to each factor. For any nonzero base: x⁰ = 1, and a negative exponent means reciprocal — x⁻ⁿ = 1/xⁿ. Rewriting with a positive exponent only moves the base; it never makes the value negative.',
      'Sets up negative and zero exponents — the same rules extend to powers like x⁰ and x⁻³ — and Algebra 1 polynomial multiplication and factoring.',
    ],
    examples: [
      { label: 'Product of Powers', problem: 'Simplify n⁵ · n².', steps: ['Same base n; the product rule applies.', 'Add the exponents: 5 + 2 = 7.', 'n⁵ · n² = n⁷.'], answer: 'n⁷' },
      { label: 'Quotient of Powers', problem: 'Simplify p⁸ ÷ p³.', steps: ['Same base p; the quotient rule applies.', 'Subtract the exponents: 8 − 3 = 5.', 'p⁸ ÷ p³ = p⁵.'], answer: 'p⁵' },
      { label: 'Power of a Power', problem: 'Simplify (c²)⁴.', steps: ['A power raised to another power.', 'Multiply the exponents: 2 · 4 = 8.', '(c²)⁴ = c⁸.'], answer: 'c⁸' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The product rule ADDS the exponents: x² · x³ = x⁵. Multiplying exponents is the power-of-a-power rule — a different situation. Second: Distributing only works over MULTIPLICATION: (xy)² = x²y². With addition you must expand: (x + y)² = x² + 2xy + y².'
  },
  '8.EE.A.2': {
    ccss: '8.EE.A.2', slug: '8-ee-a-2-square-cube-roots',
    title: 'Square & Cube Roots', grade: '8', strand: 'EE', sheets: [81],
    explanation: [
      'At this standard, students evaluate square roots of perfect squares and cube roots of perfect cubes, use radical symbols to write solutions to x² = p and x³ = p, and recognize that the root of a non-perfect power is irrational.',
      'The anchor students hold onto: Perfect squares give whole-number square roots and perfect cubes give whole-number cube roots. The root of a non-perfect number like √2 is irrational.',
      'Students will use these roots to interpret 8.NS.A.2 irrational approximations on a number line, and to classify the length outputs of 8.G.B.7-8 Pythagorean theorem problems.',
    ],
    examples: [
      { label: 'Perfect Square', problem: 'Solve x² = 49.', steps: ['Take the square root of both sides.', 'x = √49.', '7² = 49, so x = 7.'], answer: 'x = 7' },
      { label: 'Perfect Cube', problem: 'Solve x³ = 64.', steps: ['Take the cube root of both sides.', 'x = ∛64.', '4³ = 64, so x = 4.'], answer: 'x = 4' },
      { label: 'Irrational Root', problem: 'Solve x² = 2.', steps: ['Take the square root of both sides.', 'x = √2.', '√2 ≈ 1.414.. — irrational (never ends or repeats).'], answer: 'x = √2 (irrational)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: A square root is not half. √49 = 7 because 7² = 49. Second: Roots do not distribute. Add under the radical first: √(4+9) = √13 ≈ 3.61.'
  },
  '8.EE.A.3': {
    ccss: '8.EE.A.3', slug: '8-ee-a-3-scientific-notation-conversion',
    title: 'Scientific Notation Conversion', grade: '8', strand: 'EE', sheets: [70],
    explanation: [
      'At this standard, students convert between standard form and scientific notation for very large and very small numbers, using the direction of decimal movement to determine the sign and magnitude of the exponent.',
      'The anchor students hold onto: Standard → SN: move the decimal until the coefficient sits between 1 and 10; count places moved (left-move gives positive exponent, right-move gives negative).',
      'Sets up 8.EE.A.4 (Operations with Scientific Notation) by establishing fluent conversion in both directions — the prerequisite for adding, multiplying, and dividing in SN.',
    ],
    examples: [
      { label: 'Large → SN', problem: '47,000', steps: ['Move decimal 4 places left.', 'Coefficient: 4.7', '47,000 = 4.7 × 10⁴'], answer: '4.7 × 10⁴' },
      { label: 'Small → SN', problem: '0.00062', steps: ['Move decimal 4 places right.', 'Coefficient: 6.2', '0.00062 = 6.2 × 10⁻⁴'], answer: '6.2 × 10⁻⁴' },
      { label: 'SN → Standard', problem: '3.8 × 10⁵', steps: ['Exponent 5 is positive.', 'Move decimal 5 places right.', '3.8 × 10⁵ = 380,000'], answer: '380,000' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Count the number of places the decimal MOVES until one non-zero digit sits before it. That move count, not the zero count, is |n|. Second: A negative exponent means a SMALL positive number. 4.7 × 10⁻³ = 0.0047 — the negative tells which direction the decimal moves, not the sign of the result.'
  },
  '8.EE.A.4': {
    ccss: '8.EE.A.4', slug: '8-ee-a-4-operations-with-scientific-notation',
    title: 'Operations with Scientific Notation', grade: '8', strand: 'EE', sheets: [74],
    explanation: [
      'At this standard, students multiply, divide, add, and subtract numbers in scientific notation by operating on the coefficients and the powers of 10 separately, matching exponents before adding or subtracting, and renormalizing every result into 1 ≤ |c| < 10.',
      'The anchor students hold onto: Multiply/Divide: operate on the coefficients, then add or subtract the exponents. Add/Subtract: match the exponents first, then combine coefficients. Renormalize the result.',
      'Sets up Algebra 1 exponent rules and polynomial operations — the same coefficient-and-exponent decomposition reappears whenever like-base powers are multiplied or divided.',
    ],
    examples: [
      { label: 'Multiplication', problem: '(3 × 10⁴)(2 × 10³)', steps: ['Multiply coefficients: 3 · 2 = 6', 'Add exponents: 4 + 3 = 7', '(3 × 10⁴)(2 × 10³) = 6 × 10⁷'], answer: '6 × 10⁷' },
      { label: 'Division', problem: '(8 × 10⁹) ÷ (4 × 10²)', steps: ['Divide coefficients: 8 ÷ 4 = 2', 'Subtract exponents: 9 − 2 = 7', '(8 × 10⁹) ÷ (4 × 10²) = 2 × 10⁷'], answer: '2 × 10⁷' },
      { label: 'Add (Match First)', problem: '(4 × 10⁶) + (2 × 10⁵)', steps: ['Match exponents: 2 × 10⁵ = 0.2 × 10⁶', 'Add coefficients: 4 + 0.2 = 4.2', '(4 × 10⁶) + (2 × 10⁵) = 4.2 × 10⁶'], answer: '4.2 × 10⁶' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Add/subtract requires equal powers of 10 first. Rewrite 4 × 10³ as 0.04 × 10⁵, then add coefficients: 3.04 × 10⁵. Second: Renormalize: slide the decimal so 1 ≤ |c| < 10 and adjust the exponent. 30 × 10⁷ = 3.0 × 10⁸.'
  },
  '8.EE.B.5': {
    ccss: '8.EE.B.5', slug: '8-ee-b-5-proportional-relationships',
    title: 'Proportional Relationships', grade: '8', strand: 'EE', sheets: [79],
    explanation: [
      'The anchor students hold onto: To find k: pick any point (x, y) on the line — not the origin — and compute k = y ÷ x. To compare two relationships, the larger k means the steeper graph and the greater rate.',
      'Students extend proportional graphs to slope-intercept form y = mx + b in Slope-Intercept Form, then graph and compare equations of all forms in Graphing Linear Equations.',
    ],
    examples: [
      { label: 'Find k from an equation', problem: 'Find k for y = 6x.', steps: ['y = kx form: the coefficient of x is k.', 'Read off: k = 6.', 'Unit rate: 6 units of y per 1 unit of x.'], answer: 'k = 6; equation is y = 6x.' },
      { label: 'Compare two relationships', problem: 'Compare y = 4x and y = x.', steps: ['Read each k: first equation k = 4; second k = 1.', 'Compare: 4 > 1.', 'The larger k means a steeper line and greater rate.'], answer: 'y = 4x has the greater unit rate (k = 4 vs k = 1).' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: k = y / x: the output variable (y) is always the numerator. Divide y by x, not x by y. Second: Substitute x = 0: y = 2, not 0. The graph misses the origin — proportional requires y = 0 when x = 0.'
  },
  '8.EE.B.6': {
    ccss: '8.EE.B.6', slug: '8-ee-b-6-slope-intercept-form',
    title: 'Slope-Intercept Form', grade: '8', strand: 'EE', sheets: [77],
    explanation: [
      'The anchor students hold onto: To graph y = mx + b: plot the y-intercept (0, b) first. From there, use the slope m as rise over run to find a second point. Draw the line through both points.',
      'Students use slope-intercept form to graph and compare linear functions in Graphing Linear Equations, then find intersections in Systems by Graphing.',
    ],
    examples: [
      { label: 'Graph y = 2x + 1', problem: 'Graph y = 2x + 1.', steps: ['Read off the form: m = 2; b = 1.', 'Plot the y-intercept (0, 1).', 'From (0, 1) rise 2, run 1 → (1, 3).', 'Draw a line through both points.'], answer: 'Slope 2; y-intercept (0, 1).' },
      { label: 'Graph y = −x + 4', problem: 'Graph y = −x + 4.', steps: ['Read off the form: m = −1; b = 4.', 'Plot the y-intercept (0, 4).', 'From (0, 4) drop 1, run 1 → (1, 3).', 'Both lines meet at P(1, 3).'], answer: 'Slope −1; y-intercept (0, 4).' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The y-intercept is always on the y-axis where x = 0. Plot (0, b), not (b, 0). Second: Slope = rise ÷ run: vertical change first, horizontal second.'
  },
  '8.EE.C.7a': {
    ccss: '8.EE.C.7a', slug: '8-ee-c-7a-one-none-or-infinite-solutions',
    title: 'One, None, or Infinite Solutions', grade: '8', strand: 'EE', sheets: [76],
    explanation: [
      'At this standard, students classify the solution type of a linear equation in one variable — one solution, no solution, or infinitely many solutions — by solving or simplifying until variables cancel or a unique value is found.',
      'The anchor students hold onto: Solve normally. If variables cancel and the residual is TRUE (e.g. 5 = 5), infinite solutions; if FALSE (e.g. 3 = 7), no solution; otherwise x = a.',
      'Students need this for 8.EE.C.8 systems of linear equations — systems can have one solution (intersecting), no solution (parallel lines), or infinitely many (coincident lines).',
    ],
    examples: [
      { label: 'One Solution', problem: '5x − 3 = 2x + 9', steps: ['Subtract 2x: 3x − 3 = 9.', 'Add 3: 3x = 12.', 'Divide by 3: x = 4.', 'One solution: x = 4.'], answer: 'x = 4' },
      { label: 'No Solution', problem: '2x + 3 = 2x + 7', steps: ['Subtract 2x: 3 = 7.', '3 = 7 is FALSE.', 'No solution.'], answer: 'No solution' },
      { label: 'Infinitely Many', problem: '3(x + 2) = 3x + 6', steps: ['Distribute: 3x + 6 = 3x + 6.', 'Subtract 3x: 6 = 6.', '6 = 6 is TRUE.', 'Infinitely many solutions.'], answer: 'Infinitely many solutions' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: When variable terms cancel, there is no x to isolate. The remaining statement is 15 ≠ 14 (false), so the answer is No Solution — not x = 1. Second: Distribute to EVERY term inside: 3(x + 2) = 3x + 6, not 3x + 2. An incorrect distribution changes the solution type entirely.'
  },
  '8.EE.C.7b': {
    ccss: '8.EE.C.7b', slug: '8-ee-c-7b-solving-linear-equations',
    title: 'Solving Multi-Step Linear Equations', grade: '8', strand: 'EE', sheets: [65, 66, 75],
    explanation: [
      'At this standard, students solve linear equations with rational number coefficients — fractions and decimals — using LCD-clearing and reciprocal techniques, including equations requiring the distributive property.',
      'The anchor students hold onto: Simplify first. For fractions, multiply every term by the LCD to clear. For decimals, multiply by 10 or 100. Then use inverse operations. Step 1: Define the variable. Step 2: Write the equation. Step 3: Solve. Step 4: Check the answer in the original problem context. Whatever you do to one side, do to the other. Simplify each side FIRST (distribute, then combine), then apply inverse operations in reverse PEMDAS order.',
      'Rational-coefficient fluency feeds directly into 8.F.B.4 (writing and constructing linear functions) and 8.EE.C.8b (solving systems algebraically — next in this bundle).',
    ],
    examples: [
      { label: 'Fraction Coefficient', problem: 'Solve: (3/4)x + 2 = 5', steps: ['Subtract 2 from both sides: (3/4)x = 3.', 'Multiply by the reciprocal (4/3): x = 4.'], answer: 'x = 4' },
      { label: 'Decimal Coefficient', problem: 'Solve: 0.5x + 1.5 = 4', steps: ['Subtract 1.5 from both sides: 0.5x = 2.5.', 'Divide both sides by 0.5: x = 5.'], answer: 'x = 5' },
      { label: 'Distribute + Fraction', problem: 'Solve: (1/3)(x + 9) = 5', steps: ['Distribute 1/3: (1/3)x + 3 = 5.', 'Subtract 3: (1/3)x = 2.', 'Multiply by 3: x = 6.'], answer: 'x = 6' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Multiply EVERY term on both sides by the LCD or reciprocal. Second: The reciprocal of a/b is b/a — flip numerator and denominator to clear the coefficient.'
  },
  '8.EE.C.8+C.8b': {
    ccss: '8.EE.C.8+C.8b', slug: '8-ee-c-8-solving-systems',
    title: 'Solving Systems of Equations', grade: '8', strand: 'EE', sheets: [82, 83],
    explanation: [
      'At this standard, students solve systems of two linear equations using substitution: isolate, substitute, solve, and back-substitute to find the ordered-pair solution.',
      'The anchor students hold onto: Step 1: Solve one equation for one variable. Step 2: Substitute. Step 3: Solve. Step 4: Back-substitute to find the other variable. Step 1: Line up equations in standard form. Step 2: Multiply to match a pair of coefficients. Step 3: Add or subtract to eliminate. Step 4: Solve, then back-substitute.',
      'Students use this for 8.EE.C.8c real-world systems and for #83 Systems by Elimination — a second algebraic method that reaches the same intersection a different way.',
    ],
    examples: [
      { label: 'Already Isolated', problem: 'y = 2x − 1 ; 3x + y = 9', steps: ['Substitute y = 2x − 1 into eq 2.', '3x + (2x − 1) = 9 → 5x − 1 = 9', '5x = 10 → x = 2', 'Back-sub: y = 2(2) − 1 = 3'], answer: '(2, 3) → Q1' },
      { label: 'One-Step Isolate', problem: 'x + y = 2 ; 3x − y = −6', steps: ['Solve eq 1 for y: y = 2 − x.', 'Sub into eq 2: 3x − (2 − x) = −6', '4x − 2 = −6 → 4x = −4 → x = −1', 'Back-sub: y = 2 − (−1) = 3'], answer: '(−1, 3) → Q2' },
      { label: 'Strategic Choice', problem: '3x + y = −5 ; 2x − 3y = 4', steps: ['Isolate y in eq 1: y = −5 − 3x', 'Sub into eq 2: 2x − 3(−5 − 3x) = 4', '11x = −11 → x = −1', 'Back-sub: y = −5 − 3(−1) = −2'], answer: '(−1, −2) → Q3' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Always substitute the expression into the OTHER equation. Second: Wrap the substituted expression in parentheses, then distribute.'
  },
  '8.EE.C.8a': {
    ccss: '8.EE.C.8a', slug: '8-ee-c-8a-systems-by-graphing',
    title: 'Systems by Graphing', grade: '8', strand: 'EE', sheets: [80],
    explanation: [
      'At this standard, students solve a system of two linear equations by graphing both lines on the same coordinate plane, identify the intersection point as the ordered-pair solution, and recognize that parallel lines (same slope, different y-intercepts) indicate no solution.',
      'The anchor students hold onto: Graph both lines on the same coordinate plane. The intersection point is the solution. If the lines are parallel (same slope, different y-intercepts), the system has no solution.',
      'Students apply graphing intuition in Systems by Substitution and Systems by Elimination, where algebraic methods find the exact solution when graphing-by-eye is imprecise.',
    ],
    examples: [
      { label: 'Intersecting system', problem: 'Solve: y = x + 1, x + 2y = 8.', steps: ['Rewrite x + 2y = 8 as y = -1/2 x + 4.', 'Graph y = x + 1: y-int (0, 1), slope 1.', 'Graph y = -1/2 x + 4: y-int (0, 4), slope -1/2.', 'Lines meet at (2, 3).'], answer: 'Solution: (2, 3).' },
      { label: 'Parallel system (no solution)', problem: 'Identify: y = 2x+1 and y = 2x−3.', steps: ['Both equations have slope 2.', 'y-intercepts: 1 and -3 (different).', 'Same slope + different intercepts = parallel.', 'Parallel lines never intersect.'], answer: 'No solution.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The horizontal axis is x, so the x-coordinate always comes first: write (x, y). Second: Same slope + different y-intercepts = parallel lines = no solution. Check slopes first.'
  },
  '8.EE.C.8c': {
    ccss: '8.EE.C.8c', slug: '8-ee-c-8c-systems-word-problems',
    title: 'Systems Word Problems', grade: '8', strand: 'EE', sheets: [103],
    explanation: [
      'At this standard, students solve word problems involving two unknowns by defining variables, writing a system of two equations, solving by substitution or elimination, and interpreting the answer in context.',
      'The anchor students hold onto: Step 1: Define variables. Step 2: Write two equations (one per constraint). Step 3: Solve. Step 4: Interpret the answer in context.',
      'Systems word problems appear throughout algebra and standardized tests. Students apply this skill in Algebra 1, chemistry (mixture/dilution), and economics contexts.',
    ],
    examples: [
      { label: 'Sum & Difference', problem: 'Sum is 20; diff is 6.', steps: ['Let x = larger, y = smaller.', 'x + y = 20 ; x − y = 6.', 'Add: 2x = 26 → x = 13.', 'y = 20 − 13 = 7.'], answer: '13 and 7' },
      { label: 'Price Problem', problem: 'Total $13; juice $3 more.', steps: ['Let j = juice, w = water.', 'j + w = 13 ; j = w + 3.', 'Sub: (w + 3) + w = 13 → w = 5.', 'j = 5 + 3 = 8. Juice $8, water $5.'], answer: 'juice $8, water $5' },
      { label: 'Mixture Problem', problem: '10% and 40% make 25%, 60 mL.', steps: ['Let x = 10%, y = 40% solution.', 'x + y = 60 ; 0.10x + 0.40y = 15.', 'Sub x = 60−y: 6 + 0.30y = 15.', '0.30y = 9 → y = 30, x = 30.'], answer: '30 mL each' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Identify every condition stated in the problem — each independent condition becomes its own equation. Second: Write a complete sentence using the variable definitions to interpret each value after solving.'
  },
  '8.F.A.1': {
    ccss: '8.F.A.1', slug: '8-f-a-1-functions-definition',
    title: 'Functions Definition', grade: '8', strand: 'F', sheets: [73],
    explanation: [
      'At this standard, students determine whether a relation is a function using ordered pairs, tables, mapping diagrams, and graphs, applying the vertical line test to graphical representations and identifying when any input maps to more than one output.',
      'The anchor students hold onto: Scan inputs: if each input pairs with exactly one output, it IS a function. If any input has two different outputs (or a vertical line crosses the graph twice), it is NOT a function.',
      'Students apply the function definition in Comparing Functions (8.F.A.2) and Graphing Linear Equations (8.F.A.3), then build and interpret linear models in 8.F.B.4 and 8.F.B.5.',
    ],
    examples: [
      { label: 'Function (ordered pairs)', problem: 'Pairs: (1,2),(2,4),(3,6),(4,8).', steps: ['Scan inputs: 1, 2, 3, 4 — each appears once.', 'Each input has exactly one output.', 'YES — this is a function.'], answer: 'Function (y = 2x)' },
      { label: 'Not a Function (mapping)', problem: 'Map: 1→3, 2→5, 2→7, 3→9.', steps: ['Scan inputs: 2 appears with both 5 and 7.', 'Input 2 maps to two different outputs.', 'NO — this is NOT a function.'], answer: 'Not a function (input 2 → two outputs)' },
      { label: 'Function (graph / VLT)', problem: 'Graph: y = 2x − 1. Function?', steps: ['Draw a vertical line — it hits the graph once.', 'Each x-value produces exactly one y-value.', 'YES — linear graphs always pass the VLT.'], answer: 'Function (VLT passes — line hits once)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Outputs CAN repeat. The test is inputs only — each input must pair with exactly one output. Second: The input (x) is always the independent variable — the left column in a table or left side of a mapping.'
  },
  '8.F.A.2': {
    ccss: '8.F.A.2', slug: '8-f-a-2-comparing-functions',
    title: 'Comparing Functions', grade: '8', strand: 'F', sheets: [85],
    explanation: [
      'At this standard, students extract the rate of change (slope) and initial value (y-intercept) from functions shown as tables, equations, graphs, and verbal descriptions, then compare those properties across two functions given in different representations.',
      'The anchor students hold onto: Table: Δy÷Δx = slope; output at x=0 = y-int. Equation y=mx+b: m=slope, b=y-int. Graph: rise÷run = slope; y-axis crossing = y-int. Verbal: rate = slope, starting value = y-int.',
      'Students use comparison skills in 8.F.B.4 to construct linear functions from two points or a table, and in 8.F.B.5 to sketch graphs that match qualitative descriptions.',
    ],
    examples: [
      { label: 'Table vs Equation', problem: 'Table(m=3) vs y=2x+5. Rate?', steps: ['Table: x=0,1,2,3→y=1,4,7,10. Slope=(4−1)÷1=3.', 'Equation y=2x+5: slope m=2.', 'Compare: 3>2. Table has greater rate of change.'], answer: 'Table slope 3 > equation slope 2 — table wins.' },
      { label: 'Equation vs Graph', problem: 'Eq y=4x−1 vs graph(y-int=3).', steps: ['Equation y=4x−1: slope=4, y-int=−1.', 'Graph: slope=2, y-int=3 (crosses y-axis at 3).', 'Compare y-intercepts: 3>−1. Graph wins.'], answer: 'Graph y-int 3 > equation y-int −1 — graph wins.' },
      { label: 'Verbal vs Equation', problem: 'Verbal $50/hr vs y=40x+30.', steps: ['Verbal: rate $50/hr→slope=50; fee $20→y-int=20.', 'Equation y=40x+30: slope=40, y-int=30.', 'Compare: 50>40. Verbal has greater rate.'], answer: 'Verbal slope 50 > equation slope 40 — verbal wins.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Slope from a table = Δy÷Δx between any two rows. The value at x=1 is NOT the slope. Second: Extract slope from each form first — m in y=mx+b IS slope, but slope from a table requires Δy÷Δx.'
  },
  '8.F.A.3': {
    ccss: '8.F.A.3', slug: '8-f-a-3-graphing-linear-equations',
    title: 'Graphing Linear Equations', grade: '8', strand: 'F', sheets: [78],
    explanation: [
      'The anchor students hold onto: y = mx + b · m = slope (rise over run) · b = y-intercept · rewrite Ax + By = C as y = mx + b before graphing.',
      'Use the graph of y = mx + b to compare functions (8.F.A.2), write linear models from data (8.F.B.4), and solve systems visually (8.EE.C.8a).',
    ],
    examples: [
      { label: 'Graph y = 2x − 3', problem: 'Graph y = 2x − 3.', steps: ['Identify: m = 2, b = −3.', 'Plot the y-intercept (0, −3).', 'Rise 2, run 1: next point (1, −1).', 'Draw a line through both points.'], answer: 'Slope 2; y-intercept (0, −3).' },
      { label: 'Graph 2x + y = 4', problem: 'Graph 2x + y = 4.', steps: ['Rewrite: y = −2x + 4.', 'Identify: m = −2, b = 4.', 'Plot (0, 4); rise −2, run 1 → (1, 2).', 'Draw the line through both points.'], answer: 'Slope −2; y-intercept (0, 4).' },
      { label: 'Graph y = −2', problem: 'Graph y = −2.', steps: ['Recognize: m = 0 (horizontal line).', 'Every point has y-coordinate −2.', 'Plot (0, −2) and (3, −2).', 'Draw a horizontal line at y = −2.'], answer: 'Slope 0; every point has y = −2.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Always start at the y-intercept. Apply slope as rise first (up or down), then run (right). Second: The b in y = mx + b is the y-intercept. Begin at (0, b) on the y-axis, not where the line hits x.'
  },
  '8.F.B.4': {
    ccss: '8.F.B.4', slug: '8-f-b-4-constructing-linear-functions',
    title: 'Constructing Linear Functions', grade: '8', strand: 'F', sheets: [86],
    explanation: [
      'The anchor students hold onto: Two pts: m=(y2-y1)/(x2-x1); sub pt for b. Table: slope=dy/dx; b=y at x=0. Graph: rise/run=m; y-axis=b. Verbal: rate=m, start=b.',
      'Students apply construction skills in 8.F.B.5 to sketch and interpret qualitative graphs, and in 8.EE.B.5-6 to connect slope to proportional relationships and similar triangles.',
    ],
    examples: [
      { label: '— Two Points', problem: 'Two points: (1,5) and (3,11).', steps: ['Slope: m = (11-5) / (3-1) = 6/2 = 3.', 'Use (1,5): 5 = 3(1) + b → b = 2.', 'Function: y = 3x + 2.'], answer: 'y = 3x + 2 (m = 3, b = 2)' },
      { label: '— Table', problem: 'Table: x=0,1,2,3 / y=4,7,10,13.', steps: ['Slope: (7-4) / (1-0) = 3.', 'Y-int: y = 4 when x = 0 → b = 4.', 'Function: y = 3x + 4.'], answer: 'y = 3x + 4 (m = 3, b = 4)' },
      { label: '— Verbal', problem: 'Plumber: $25/hr, $40 flat fee.', steps: ['Rate = $25/hr → slope m = 25.', 'Starting fee = $40 → b = 40.', 'Function: y = 25x + 40.'], answer: 'y = 25x + 40 (m = 25, b = 40)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Slope is a CHANGE ratio: m = (y2-y1)/(x2-x1). Always subtract coordinates. Second: Only read b directly when x = 0 is confirmed; otherwise substitute a point and solve.'
  },
  '8.F.B.5': {
    ccss: '8.F.B.5', slug: '8-f-b-5-qualitative-graph-features',
    title: 'Qualitative Graph Features', grade: '8', strand: 'F', sheets: [87],
    explanation: [
      'The anchor students hold onto: Increasing: rises left to right. Decreasing: falls left to right. Linear: straight line. Nonlinear: curved. Turning point: where direction switches.',
      'Qualitative graph reading applies directly in 8.SP.A.1 and 8.SP.A.2 — students describe scatter plot trends as increasing, decreasing, linear, or nonlinear patterns.',
    ],
    examples: [
      { label: 'Describe the Graph', problem: 'Rise, peak, fall. Describe it.', steps: ['Left side: graph is increasing.', 'At the peak: turning point.', 'After the peak: decreasing.'], answer: 'Increases to a turning point; then decreases. Nonlinear.' },
      { label: 'Sketch from Words', problem: 'Sketch: slow rise, steep fall.', steps: ['Slowly uphill = increasing.', 'Quickly downhill = decreasing.', 'Sketch: gentle rise then sharp fall.'], answer: 'Gentle increase then steep decrease; one turning point.' },
      { label: 'Real-World Mixed', problem: 'Rises all morning, flat at noon.', steps: ['Rising all morning = increasing interval.', 'Stays flat = constant (neither).', 'Sketch: rise, then horizontal segment.'], answer: 'Increasing then constant; no turning point — plateau.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Use output language: the output value increases as the input increases — always describe what the output does. Second: A turning point is an interior direction change — where the graph switches from increasing to decreasing (or vice versa).'
  },
  '8.G.A.1': {
    ccss: '8.G.A.1', slug: '8-g-a-1-translations',
    title: 'Translations', grade: '8', strand: 'G', sheets: [89],
    explanation: [
      'The anchor students hold onto: For a translation by (dx, dy), every point (x, y) maps to (x + dx, y + dy). Image vertices take primed names: A maps to A-prime, B to B-prime.',
      'Students extend translation thinking into reflections, rotations, and dilations, then compose multiple rigid motions to prove congruence and similarity in the transformations strand.',
    ],
    examples: [
      { label: '— Translate a point', problem: 'Translate (1, 2) by (4, -3).', steps: ['Add dx to x: 1 + 4 = 5.', 'Add dy to y: 2 + (-3) = -1.'], answer: 'Image: (5, -1).' },
      { label: '— Translate a triangle', problem: 'Translate ABC by (2, 4).', steps: ['Apply (2, 4) to each vertex.', 'A\'(2, 4); B\'(5, 4); C\'(3, 6).'], answer: 'A\'(2, 4); B\'(5, 4); C\'(3, 6).' },
      { label: '— Find the vector', problem: 'A(1,3) to A\'(5,1). Find vector.', steps: ['dx = 5 - 1 = 4.', 'dy = 1 - 3 = -2.'], answer: 'Translation vector: (4, -2).' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: In (3, -2), dx = 3 moves right and dy = -2 moves DOWN. dx is horizontal; dy is vertical. Second: Translate each vertex individually using (dx, dy). All vertices shift the same way — image is congruent to the preimage.'
  },
  '8.G.A.2': {
    ccss: '8.G.A.2', slug: '8-g-a-2-reflections-congruence',
    title: 'Reflections & Congruence', grade: '8', strand: 'G', sheets: [90, 93],
    explanation: [
      'The anchor students hold onto: A reflection flips a figure across an axis. Each point and its image lie the same distance from the axis on opposite sides. Image vertices take primed names. Apply the first op to every preimage vertex, then apply the second op to that result. The image is named with double primes after a 2-op chain.',
      'Students extend reflection thinking into rotations (#91), dilations (#92), and compose multiple rigid motions in #93 Congruence through Transformations.',
    ],
    examples: [
      { label: 'Reflect a point — x-axis', problem: 'Reflect (3, 4) over the x-axis.', steps: ['Keep x; negate y.', '(3, 4) maps to (3, -4).'], answer: 'Image: (3, -4).' },
      { label: 'Reflect a triangle — y-axis', problem: 'Reflect △PQR over the y-axis.', steps: ['Negate x; keep y for each vertex.', 'P(3,2)→P\'(-3,2); Q(6,2)→Q\'(-6,2); R(4,5)→R\'(-4,5).'], answer: 'P\'(-3,2); Q\'(-6,2); R\'(-4,5).' },
      { label: 'Reflect a triangle — y = x', problem: 'Reflect △ABC over y = x.', steps: ['Swap x and y for each vertex.', 'A(1,5)→A\'(5,1); B(4,5)→B\'(5,4); C(2,8)→C\'(8,2).'], answer: 'A\'(5,1); B\'(5,4); C\'(8,2).' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: x-axis: negate y only. y-axis: negate x only. The axis name tells you which coordinate stays. Second: Reflection over y = x swaps coordinates only: (x, y) → (y, x). No negation.'
  },
  '8.G.A.3': {
    ccss: '8.G.A.3', slug: '8-g-a-3-rotations',
    title: 'Rotations', grade: '8', strand: 'G', sheets: [91],
    explanation: [
      'The anchor students hold onto: Rotate about the origin: 90° CCW uses (−y, x); 180° uses (−x, −y); 270° CCW uses (y, −x). CCW is the CCSS default unless stated otherwise.',
      'Students extend rotation thinking in Dilations, then compose multiple transformations in Congruence through Transformations.',
    ],
    examples: [
      { label: 'Rotate 90° CCW', problem: 'Rotate (3, 2) by 90° CCW.', steps: ['Rule: 90° CCW gives (-y, x).', 'Apply: (3, 2) gives (-2, 3).'], answer: '(-2, 3)' },
      { label: 'Rotate 180°', problem: 'Rotate point (4, 1) by 180°.', steps: ['Rule: 180° gives (-x, -y).', 'Apply: (4, 1) gives (-4, -1).'], answer: '(-4, -1)' },
      { label: 'Rotate 270° CCW', problem: 'Rotate (2, 5) by 270° CCW.', steps: ['Rule: 270° CCW gives (y, -x).', 'Apply: (2, 5) gives (5, -2).'], answer: '(5, -2)' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: CCW is the CCSS default. The 90° CCW rule is (-y, x), not (y, -x). Second: Remember: 90° CCW = (-y, x); 270° CCW = (y, -x). The signs flip between them.'
  },
  '8.G.A.4': {
    ccss: '8.G.A.4', slug: '8-g-a-4-dilations-similarity',
    title: 'Dilations & Similarity', grade: '8', strand: 'G', sheets: [92, 94],
    explanation: [
      'The anchor students hold onto: To dilate about the origin by scale factor k: apply (x, y) -> (kx, ky) to every vertex. If k > 1 the image enlarges; if 0 < k < 1 the image reduces. When a sequence of transformations includes a dilation (k ≠ 1), the image is similar to the preimage — same shape, different size.',
      'Students extend dilation thinking into congruence-through-transformations (#93), then compose dilations with rigid motions to establish similarity (#94 Similarity).',
    ],
    examples: [
      { label: 'Point dilation k=2', problem: 'Dilate (3, 4) by k=2; center O.', steps: ['Apply (x, y) -> (2x, 2y).', '(3, 4) -> (6, 8).'], answer: 'Image: (6, 8).' },
      { label: 'Triangle reduction k=1/2', problem: 'Dilate XYZ; k=1/2 about origin.', steps: ['Apply (x, y) -> (x/2, y/2) to each vertex.', 'X(4, 2) -> X\'(2, 1); Y(6, 8) -> Y\'(3, 4); Z(2, 6) -> Z\'(1, 3).'], answer: 'X\'(2, 1); Y\'(3, 4); Z\'(1, 3).' },
      { label: 'Dilation about (1, 1)', problem: 'Dilate PQR; k=2 about (1, 1).', steps: ['Apply (x,y) -> (1+2(x-1), 1+2(y-1)) for each vertex.', 'P(2, 2) -> P\'(3, 3); Q(4, 2) -> Q\'(7, 3); R(3, 4) -> R\'(5, 7).'], answer: 'P\'(3, 3); Q\'(7, 3); R\'(5, 7).' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The scale factor multiplies BOTH coordinates. The correct image is (6, 8). Second: Scale factor applies to distances, not areas. Each coordinate is multiplied by k, not k squared.'
  },
  '8.G.A.5': {
    ccss: '8.G.A.5', slug: '8-g-a-5-angle-relationships',
    title: 'Angle Relationships', grade: '8', strand: 'G', sheets: [95],
    explanation: [
      'The anchor students hold onto: Congruent pairs: corresponding · alternate interior · alternate exterior · vertical. Supplementary pairs: co-interior · linear pair (sum = 180°).',
      'Angle pair facts extend directly to #96 Pythagorean Theorem and to the angle-angle (AA) similarity criterion for triangles later in 8th grade.',
    ],
    examples: [
      { label: 'Corresponding angles', problem: 'Find ∠5; ℓ₁ ∥ ℓ₂, ∠1 = 55°.', steps: ['Corresponding pairs: same position at each intersection.', '∠1 and ∠5 are both upper-left at their intersections.'], answer: '∠5 = 55° (congruent).' },
      { label: 'Co-interior angles', problem: 'Find ∠6; ℓ₁ ∥ ℓ₂, ∠3 = 112°.', steps: ['∠3 and ∠6 are co-interior: same side of t, between the parallel lines.', '∠3 + ∠6 = 180°. 112° + ∠6 = 180°.'], answer: '∠6 = 68° (supplementary).' },
      { label: 'Vertical angles', problem: 'At P, find ∠3 if ∠1 = 55°.', steps: ['Vertical pairs form at each intersection (opposite rays).', '∠1 and ∠3 are vertical at P.'], answer: '∠3 = 55° (congruent).' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Co-interior pairs are SUPPLEMENTARY — they sum to 180°, not share a measure. Second: The named relationships only hold when ℓ₁ ∥ ℓ₂. Always verify parallelism (tick marks or stated) first.'
  },
  '8.G.B.6': {
    ccss: '8.G.B.6', slug: '8-g-b-6-converse-of-pythagorean-theorem',
    title: 'Converse of Pythagorean Theorem', grade: '8', strand: 'G', sheets: [88],
    explanation: [
      'The anchor students hold onto: Sort sides: a ≤ b ≤ c. Compute a²+b² and compare to c². Equal → right. Greater → acute. Less → obtuse.',
      'The converse underpins Pythagorean Distance on the Coordinate Plane and applies whenever right-angle verification appears in geometry proofs.',
    ],
    examples: [
      { label: '', problem: 'Explain the proof of a²+b²=c².', steps: ['Each side forms a square with area a², b², or c².', 'Leg-squares sum equals hyp-square: a²+b²=c².'], answer: 'The area of the two leg-squares always equals the hypotenuse-square.' },
      { label: '', problem: 'Sides 6, 8, 10: right triangle?', steps: ['Identify longest side: c = 10.', 'a²+b² = 6²+8² = 36+64 = 100 = 10².', '100 = 100 → right triangle.'], answer: 'Yes — 6, 8, 10 is a right triangle (6²+8²=10²).' },
      { label: '', problem: 'Classify: sides 5, 7, 9.', steps: ['Longest side: c = 9.', 'a²+b² = 5²+7² = 25+49 = 74; c² = 81.', '74 < 81 → a²+b² < c² → obtuse.'], answer: 'Obtuse triangle (a²+b² < c²).' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Sort the three sides first: a ≤ b ≤ c. Use only the two shorter sides as a and b. Second: Converse: if a²+b²=c², then right. If not equal, compare > or < c² to classify.'
  },
  '8.G.B.7': {
    ccss: '8.G.B.7', slug: '8-g-b-7-pythagorean-theorem',
    title: 'Pythagorean Theorem', grade: '8', strand: 'G', sheets: [96],
    explanation: [
      'The anchor students hold onto: a² + b² = c². To find c (hypotenuse): square the legs, add, take √. To find a missing leg: subtract the known squared values, then take √. Round with ≈ if irrational.',
      'Pythagorean Theorem side lengths power #97 Distance on the Coordinate Plane and extend into 3D diagonal problems in high school geometry and Algebra 1.',
    ],
    examples: [
      { label: '', problem: 'Legs 6, 8. Find hypotenuse c.', steps: ['Substitute: 6² + 8² = c².', '36 + 64 = 100 = c².', 'c = √100.'], answer: 'c = 10.' },
      { label: '', problem: 'Hyp 13, one leg 5. Find leg.', steps: ['Rearrange: leg = √(c² − known²).', '√(13² − 5²) = √(169 − 25).', '√144.'], answer: 'Missing leg = 12.' },
      { label: '', problem: 'Legs 3, 5. Find c, nearest 0.1.', steps: ['3² + 5² = c².', '9 + 25 = 34 = c².', 'c = √34.'], answer: 'c ≈ 5.8.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Square each leg first, then add. The formula is a² + b² = c², not (a + b)² = c². Second: Find the right angle first (∠ = 90°). The side directly across from it is always the hypotenuse c.'
  },
  '8.G.B.8': {
    ccss: '8.G.B.8', slug: '8-g-b-8-distance-on-coordinate-plane',
    title: 'Distance on Coordinate Plane', grade: '8', strand: 'G', sheets: [97],
    explanation: [
      'At this standard, students apply the Pythagorean Theorem to find the distance between two points on the coordinate plane by identifying and squaring the horizontal and vertical legs of a right triangle.',
      'The anchor students hold onto: Build a right triangle: horizontal leg = change in x, vertical leg = change in y. Then a² + b² = c² gives the distance c. Take √ at the end; round with ≈ if needed.',
      'Distance on the coordinate plane unlocks the Distance Formula in high school algebra, the equation of a circle, and vector magnitude in physics — all built on a² + b² = c².',
    ],
    examples: [
      { label: 'Anchor (6-8-10)', problem: 'Find: A(1, 2) to B(7, 10).', steps: ['Horizontal: 7 − 1 = 6. Vertical: 10 − 2 = 8.', '6² + 8² = c².', '36 + 64 = 100 = c².'], answer: 'c = √100 = 10.' },
      { label: 'Four quadrants', problem: 'Find: (−3, 1) to (5, 7).', steps: ['Horizontal: 5 − (−3) = 8. Vertical: 7 − 1 = 6.', '8² + 6² = c².', '64 + 36 = 100 = c².'], answer: 'c = √100 = 10.' },
      { label: 'Irrational distance', problem: 'Nearest tenth: (1, 1) to (4, 3).', steps: ['Horizontal: 4 − 1 = 3. Vertical: 3 − 1 = 2.', '3² + 2² = c².', '9 + 4 = 13 = c².'], answer: 'c = √13 ≈ 3.6.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Square each leg: a² + b² = c². Then take √ for the distance. Second: Always take √ at the end: c = √100 = 10, not 100.'
  },
  '8.G.C.9': {
    ccss: '8.G.C.9', slug: '8-g-c-9-volume-of-cones-cylinders-spheres',
    title: 'Volume of Cones, Cylinders, Spheres', grade: '8', strand: 'G', sheets: [98],
    explanation: [
      'At this standard, students identify and apply the volume formulas for cylinders (V=πr²h), cones (V=⅓πr²h), and spheres (V=4/3πr³) to find volumes in real-world and mathematical contexts.',
      'The anchor students hold onto: Cylinder: V = πr²h. Cone: V = ⅓πr²h (one-third of a cylinder). Sphere: V = 4/3πr³, where r is the radius (cubed for a sphere).',
      'These volume formulas close 8th-grade geometry and carry into high school surface area, composite solids, and applied measurement involving real-world containers, planets, and engineering.',
    ],
    examples: [
      { label: 'Cylinder volume', problem: 'Cylinder: r = 3 cm, h = 10 cm.', steps: ['Substitute into V = πr²h.', 'V = π · 3² · 10 = π · 9 · 10.', 'V = 90π.'], answer: 'V = 90π cm³.' },
      { label: 'Cone volume', problem: 'Cone: r = 6 in, h = 9 in.', steps: ['Substitute into V = ⅓πr²h.', 'V = ⅓ · π · 6² · 9 = ⅓ · 324π.', 'V = 108π.'], answer: 'V = 108π in³.' },
      { label: 'Sphere volume', problem: 'Sphere: r = 3 ft; π ≈ 3.14.', steps: ['Substitute into V = 4/3πr³.', 'V = 4/3 · π · 3³ = 4/3 · 27π = 36π.', 'V ≈ 36 · 3.14 ≈ 113.04.'], answer: 'V ≈ 113 ft³.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: V = 4/3πr³ uses r CUBED — multiply r by itself three times, not twice. Second: The cone formula is exactly one-third of the same-base cylinder formula.'
  },
  '8.NS.A.1': {
    ccss: '8.NS.A.1', slug: '8-ns-a-1-rational-vs-irrational-numbers',
    title: 'Rational vs Irrational Numbers', grade: '8', strand: 'NS', sheets: [68],
    explanation: [
      'At this standard, students classify a real number as rational or irrational by testing whether its decimal form terminates, repeats in a fixed block, or does neither.',
      'The anchor students hold onto: Look at the decimal form. If it TERMINATES or REPEATS in a fixed block, the number is RATIONAL. If it never ends and never repeats, it is IRRATIONAL.',
      'Students will need this skill to interpret outputs of 8.EE.A.2 square root and cube root operations, and to classify length values from 8.G.B.7-8 Pythagorean theorem applications.',
    ],
    examples: [
      { label: 'Rational (Terminating)', problem: 'Is 0.625 rational?', steps: ['Check the decimal: does it terminate or repeat?', 'It ends after 3 digits (terminates).', 'Terminating decimal → RATIONAL. (= 5/8)'], answer: 'Rational' },
      { label: 'Rational (Repeating)', problem: 'Is 0.4444.. rational?', steps: ['Check the decimal: does it terminate or repeat?', 'The digit 4 repeats forever (0.4444..).', 'Repeating decimal → RATIONAL. (= 4/9)'], answer: 'Rational' },
      { label: 'Irrational', problem: 'Is √7 rational?', steps: ['Check the decimal: does it terminate or repeat?', '√7 = 2.6457513.. never terminates, never repeats.', 'Non-terminating non-repeating → IRRATIONAL.'], answer: 'Irrational' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Check for a perfect square first: √16 = 4 and √0.25 = 0.5 are rational. Second: A decimal that ends, or has a fixed repeating block, is rational no matter how long.'
  },
  '8.NS.A.2': {
    ccss: '8.NS.A.2', slug: '8-ns-a-2-approximating-irrationals',
    title: 'Approximating Irrationals', grade: '8', strand: 'NS', sheets: [84],
    explanation: [
      'At this standard, students approximate irrational numbers as decimals, locate them on a number line between consecutive integers, and compare irrational values using decimal approximations — building the bridge from perfect-square root evaluation (8.EE.A.2) to number-line placement (8.NS.A.2).',
      'The anchor students hold onto: Find the two consecutive perfect squares bracketing the radicand; their roots are the integer bounds. Use proximity to the nearer perfect square to estimate one decimal.',
      'These approximations connect directly to 8.G.B.7 Pythagorean theorem outputs like √2 and √5, and give irrational equation solutions from 8.EE.A.2 their number-line meaning.',
    ],
    examples: [
      { label: 'Locate on Number Line', problem: 'Locate √7 on a number line.', steps: ['Find surrounding perfect squares: 4 < 7 < 9.', '√4 = 2 and √9 = 3, so √7 is between 2 and 3.', '7 is closer to 9 than to 4, so √7 ≈ 2.6.'], answer: '√7 ≈ 2.6 (between 2 and 3)' },
      { label: 'Estimate as Decimal', problem: 'Estimate √20 to one decimal.', steps: ['Find surrounding perfect squares: 16 < 20 < 25.', '√16 = 4 and √25 = 5, so √20 is between 4 and 5.', '20 is closer to 16 than to 25, so √20 ≈ 4.5.'], answer: '√20 ≈ 4.5 (between 4 and 5)' },
      { label: 'Compare Irrationals', problem: 'Which is greater: √6 or √8?', steps: ['√6: between √4=2 and √9=3 — √6 ≈ 2.4.', '√8: between √4=2 and √9=3 — √8 ≈ 2.8.', '2.8 > 2.4, so √8 > √6.'], answer: '√8 > √6' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: A square root is not half the value. Find the two perfect squares bracketing N, then take their roots. Second: 5 is closer to 4 than to 9, so √5 ≈ 2.2, not 2.5. Proximity to the nearer square determines the estimate.'
  },
  '8.SP.A.1': {
    ccss: '8.SP.A.1', slug: '8-sp-a-1-scatter-plots',
    title: 'Scatter Plots', grade: '8', strand: 'SP', sheets: [99],
    explanation: [
      'At this standard, students construct scatter plots from bivariate data and interpret patterns of association by identifying direction (positive, negative, or none), form (linear or nonlinear), and features such as clustering and outliers.',
      'The anchor students hold onto: Describe a scatter plot by its association type (positive, negative, or none) and its form (linear or nonlinear). Always check for clustering and outliers.',
      'In Lines of Best Fit (8.SP.A.2), students use scatter plot patterns from this skill to draw and assess linear models through the data.',
    ],
    examples: [
      { label: 'Positive Linear', problem: 'Hours practiced vs. free-throw %', steps: ['Direction: rises left to right → positive.', 'Form: roughly straight line → linear.', 'Association: positive linear association.'], answer: 'Positive linear association.' },
      { label: 'Negative Nonlinear', problem: 'Miles (x) vs. tread depth (y)', steps: ['Direction: drops left to right → negative.', 'Form: curve flattens at high x → nonlinear.', 'Association: negative nonlinear association.'], answer: 'Negative nonlinear association.' },
      { label: 'No Association', problem: 'Shoe size (x) vs. math score (y)', steps: ['No consistent rise or fall → no trend visible.', 'Form: cannot be determined — no pattern.', 'Association: no association.'], answer: 'No association.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: Spread = weak association, not no association. Look for any consistent rise or fall first. Second: Scatter plots show association only. Causation requires controlled experiments, not just correlation.'
  },
  '8.SP.A.2': {
    ccss: '8.SP.A.2', slug: '8-sp-a-2-lines-of-best-fit',
    title: 'Lines of Best Fit', grade: '8', strand: 'SP', sheets: [100],
    explanation: [
      'At this standard, students recognize when a linear association supports a line of best fit, describe correct placement through the center of the data cloud, and assess model fit by judging how tightly data points cluster around the line.',
      'The anchor students hold onto: A line of best fit is a straight line drawn through the middle of a linear scatter plot, minimizing overall distance to all points. Judge fit by how tightly points cluster around it.',
      'In Scatter Plot Slope & Intercept (8.SP.A.3), students extend this skill by interpreting the slope and y-intercept of the line of best fit in real-world context.',
    ],
    examples: [
      { label: 'Recognize Linear Association', problem: 'Should you fit a line here?', steps: ['Check direction: do points rise or fall consistently?', 'If yes (linear trend), a line of best fit is appropriate.', 'If the plot is curved or random, no line is needed.'], answer: 'Yes — a consistent linear trend supports a line of best fit.' },
      { label: 'Fit the Line', problem: 'Where should the trend line go?', steps: ['Draw ONE straight line through the center of the cloud.', 'Balance: roughly half the points above and half below.', 'The line does not need to pass through any data point.'], answer: 'Through the middle — about half the points above, half below.' },
      { label: 'Assess Model Fit', problem: 'Is this a strong or weak fit?', steps: ['Examine how closely points cluster around the trend line.', 'Tight cluster (small gaps) → strong model fit.', 'Loose scatter (large gaps) → weak model fit.'], answer: 'Strong fit: tight cluster. Weak fit: points spread far from the line.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: The line must balance ALL points — about half above and half below the entire cloud, not just the two endpoints. Second: Fit is judged by how tightly ALL points cluster around the line, not how many the line touches exactly.'
  },
  '8.SP.A.3': {
    ccss: '8.SP.A.3', slug: '8-sp-a-3-scatter-plot-slope-intercept',
    title: 'Scatter Plot Slope & Intercept', grade: '8', strand: 'SP', sheets: [102],
    explanation: [
      'At this standard, students interpret the slope and y-intercept of a trend line equation in real-world context, use the equation to make predictions, and evaluate when the y-intercept is or is not meaningful within the data range.',
      'The anchor students hold onto: Slope m: for each +1 x-unit, y increases or decreases by m. Y-intercept b: predicted y when x = 0. To predict: substitute the x-value into y = mx + b and solve for y.',
      'In Two-Way Tables (8.SP.A.4), students shift from bivariate measurement data to categorical data, using two-way tables and relative frequencies to explore patterns of association.',
    ],
    examples: [
      { label: 'Interpret the Slope', problem: 'What does the slope mean here?', steps: ['Locate m: slope = 1 (coefficient of x in y = x + 1).', 'Rate of change: for each +1 hr slept, focus score rises by 1.', 'Units: slope always carries y-unit per x-unit.'], answer: 'Slope = 1: each extra hour of sleep raises focus score by 1 point.' },
      { label: 'Interpret the y-Intercept', problem: 'What does the y-intercept mean?', steps: ['Locate b: y-intercept = 1 (constant in y = x + 1).', 'Y-intercept is the predicted y when x = 0.', 'Context: 0 hr sleep → predicted focus score of 1.'], answer: 'Y-intercept = 1: at 0 hours of sleep, predicted focus score is 1.' },
      { label: 'Predict Using the Equation', problem: 'What does y equal when x = 6?', steps: ['Write the equation: y = x + 1.', 'Substitute x = 6: y = 6 + 1.', 'Compute: y = 7.'], answer: 'y = 7: the model predicts a focus score of 7 after 6 hours of sleep.' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: In y = mx + b, m is always the coefficient of x (slope), and b is always the constant (y-intercept). Identify each by its position in the equation, not its value. Second: The y-intercept is a model prediction at x = 0. If x = 0 makes no real-world sense (for example, 0 years of experience), treat it as a mathematical value, not a useful prediction.'
  },
  '8.SP.A.4': {
    ccss: '8.SP.A.4', slug: '8-sp-a-4-two-way-tables',
    title: 'Two-Way Tables', grade: '8', strand: 'SP', sheets: [69],
    explanation: [
      'The anchor students hold onto: To classify a relative frequency, identify the denominator: grand total → Joint; row or column total → Marginal; one row or column total → Conditional.',
      'Students extend two-way analysis to numeric data in Scatter Plots and Lines of Best Fit (8.SP.A.1–3), using relative frequency reasoning as a foundation for bivariate data interpretation.',
    ],
    examples: [
      { label: 'Joint', problem: 'Find P(7th AND Bring): 8/50.', steps: ['Denominator = grand total = 50.', 'Cell count = 8 (7th AND Bring Lunch).', 'Joint = 8/50 = 0.16 = 16%.'], answer: 'Joint = 0.16' },
      { label: 'Marginal', problem: 'Find P(Bring Lunch): 20/50.', steps: ['Denominator = grand total = 50.', 'Row total = 20 (Bring Lunch overall).', 'Marginal = 20/50 = 0.40 = 40%.'], answer: 'Marginal = 0.40' },
      { label: 'Conditional', problem: 'P(Bring GIVEN 7th): 8/22.', steps: ['Denominator = 7th grade total = 22.', 'Cell count = 8 (7th AND Bring).', 'Conditional = 8/22 ≈ 0.36 = 36%.'], answer: 'Conditional ≈ 0.36' },
    ],
    tip: 'Head off the two predictable errors before they happen. First: When a question restricts to one category ("given" or "of those"), use that row or column total as the denominator, not the grand total. Second: The category named after "given" is always the denominator; the category named before "given" is the cell count numerator.'
  },
};

/* Per-standard mistake cards: misconception wrong->fix pairs, with a named
   error-analysis scenario attached as a "Try this" prompt where available.
   Keyed by clean CCSS leaf code. Generated from config data. */
const STD_ERRORS = {
  '6.EE.A.1': [
    { label: 'Mistake A', wrong: 'Adding or subtracting before multiplying or dividing when no parentheses are present.', fix: 'Apply ×/÷ left to right before +/− — multiply first, then add.', prompt: 'A student evaluates 4² = 4 × 2 = 8. Identify the error and give the correct evaluation.' },
    { label: 'Mistake B', wrong: 'Evaluating the exponent AFTER multiplying or using the base as a coefficient first.', fix: 'Exponents come before ×/÷ — resolve the power before multiplying.', prompt: 'A student evaluates 2⁵ = 25 by writing the base and exponent digits side by side. Identify the error and give the correct evaluation.' },
    { label: 'Mistake C', wrong: 'Student multiplies base × exponent: evaluates 4² as 4×2 = 8.', fix: 'The exponent counts repeated factors, not a multiplier. 4² = 4×4 = 16.', prompt: null },
    { label: 'Mistake D', wrong: 'Student assumes switching base and exponent never changes the value.', fix: '2³ = 8 but 3² = 9. Switching base and exponent usually changes the value.', prompt: null },
  ],
  '6.EE.A.2a': [
    { label: 'Mistake A', wrong: 'Student writes 3n for "the sum of n and 3" (confuses multiplication with addition).', fix: '3n means 3 × n. "The sum of n and 3" is n + 3.', prompt: 'A student writes 9 − n for "9 less than a number n." Identify the error and write the correct expression.' },
    { label: 'Mistake B', wrong: 'Student writes 8 − n for "8 less than n" (reverses subtraction order).', fix: '"Less than" reverses order: "8 less than n" = n − 8, not 8 − n.', prompt: 'A student writes 3n for "the sum of a number n and 3." Identify the error and write the correct expression.' },
  ],
  '6.EE.A.2b': [
    { label: 'Mistake A', wrong: 'Calling every number in an expression a coefficient.', fix: 'A coefficient multiplies a variable. In 5x + 8, the coefficient is 5; the 8 is a constant term.', prompt: 'A student names the coefficient in 9 + 2x. Student work: "The coefficient is 9." Identify the error and give the correct coefficient.' },
    { label: 'Mistake B', wrong: 'Calling all parts of any expression terms, even when the expression is a product.', fix: 'Terms are parts of a SUM. Parts of a PRODUCT are called factors. Find the main operation first.', prompt: 'A student counts the terms in 3(x + 4) + 7. Student work: "3 terms: 3, x, 7." Identify the error and give the correct term count.' },
  ],
  '6.EE.A.2c': [
    { label: 'Mistake A', wrong: 'Student adds before multiplying: evaluates 3n + 5 at n = 4 as 3(4 + 5) = 27.', fix: 'Order of operations: multiply FIRST. 3(4) + 5 = 12 + 5 = 17.', prompt: 'A student evaluates 2m + 6 at m = 5 and gets 22. Identify the error and find the correct value.' },
    { label: 'Mistake B', wrong: 'Student applies the exponent to the coefficient: evaluates 2n² at n = 4 as (2×4)² = 64.', fix: 'The exponent applies only to n. 2n² = 2(n²) = 2(4²) = 2(16) = 32.', prompt: 'A student claims n − 8 and 8 − n are equal when n = 10. Evaluate both and explain whether the student is correct.' },
  ],
  '6.EE.A.3': [
    { label: 'Mistake A', wrong: 'Student expands 4(n − 3) as 4n + 12 (loses the minus sign).', fix: 'The sign is part of the term: 4 × (−3) = −12. Correct result: 4n − 12.', prompt: 'A student expands 4(n + 5) and writes 4n + 5. Identify the error and give the correct expanded form.' },
    { label: 'Mistake B', wrong: 'Student only multiplies the first term: 3(n + 2) = 3n + 2.', fix: 'EVERY term inside gets multiplied: 3(n + 2) = 3n + 6. Never skip a term.', prompt: 'A student expands 4(n − 3) and writes 4n + 12. Identify the sign error and give the correct expanded form.' },
  ],
  '6.EE.A.3+A.4': [
    { label: 'Mistake A', wrong: 'Student combines 3n + 2 to get 5n (treats constant as a like term).', fix: '3n and 2 are NOT like terms — one has a variable, one is a constant. Answer stays 3n + 2.', prompt: 'A student simplifies 3n + 2 and writes 5n. Identify the error and give the correct simplified form.' },
    { label: 'Mistake B', wrong: 'Student says the coefficient of n is 0 and drops the variable term.', fix: 'When no number is written in front of a variable, the coefficient is 1, not 0. n = 1n.', prompt: 'A student simplifies 4n + 3 + 2n and writes 9n. Identify the error and find the correct answer.' },
  ],
  '6.EE.A.4': [
    { label: 'Mistake A', wrong: 'Thinking two expressions are equivalent because they give the same result for one value of x — equal for one value does not mean equivalent for all values.', fix: 'Equivalent means the same value for EVERY substitution. Test at least two values, or simplify both sides to the same form, to be certain.', prompt: 'Student work: 4(x + 3) = 4x + 3 Conclusion: 4(x + 3) and 4x + 3 are equivalent. The student above made an error. Find and fix the error. Then test with x = 1 to confirm your correction.' },
    { label: 'Mistake B', wrong: 'Only distributing to the first term: writing 4(x + 3) = 4x + 3 instead of 4x + 12.', fix: 'The factor multiplies EVERY term inside the parentheses: 4 × x AND 4 × 3 = 4x + 12. Distribute to all terms.', prompt: null },
  ],
  '6.EE.B.5+B.6': [
    { label: 'Mistake A', wrong: 'Writing 3 - n for "3 less than n" -- reversing the order of subtraction.', fix: '"3 less than n" subtracts 3 FROM n: write n - 3, not 3 - n.', prompt: 'Student work: "3 times a number equals 12" 3 + n = 12 (WRONG) A student wrote 3 + n = 12 for "3 times a number equals 12." Find and fix the error. Then test n = 4 to confirm your correction.' },
    { label: 'Mistake B', wrong: 'Substituting correctly but comparing only one side -- not checking that BOTH sides are equal.', fix: 'After substituting, simplify both sides separately, then compare: if they match, it IS a solution.', prompt: null },
  ],
  '6.EE.B.7': [
    { label: 'Mistake A', wrong: 'Student solves 6n = 48 by multiplying both sides by 6, getting n = 288.', fix: 'To undo multiplication, DIVIDE both sides: n = 48 ÷ 6 = 8. Use the inverse operation.', prompt: 'A student solves n + 7 = 20 and writes n = 27. Identify the error and give the correct solution.' },
    { label: 'Mistake B', wrong: 'Student solves n + 8 = 15 by adding 8 to both sides (same operation, not inverse).', fix: 'Use the INVERSE: subtract 8 from both sides — n = 15 − 8 = 7.', prompt: 'A student solves 6n = 48 and writes n = 288. Identify the error and give the correct solution.' },
  ],
  '6.EE.B.8': [
    { label: 'Mistake A', wrong: 'Shading in the wrong direction -- shading left for x > c or right for x < c.', fix: '> means GREATER THAN -- shade right toward larger values. < means LESS THAN -- shade left.', prompt: 'Student work: "a plant must grow taller than 48 cm" h < 48 (WRONG) A student wrote h < 48 for "a plant must grow taller than 48 centimeters." Find and fix the error. Then check if h = 50 is a solution to your corrected inequality.' },
    { label: 'Mistake B', wrong: 'Drawing a filled circle at the boundary instead of an open circle for strict > and <.', fix: 'x > c and x < c do NOT include the boundary value -- always use an OPEN circle.', prompt: null },
  ],
  '6.EE.C.9': [
    { label: 'Mistake A', wrong: 'Writing x = [rate] × y instead of y = [rate] × x — treating the dependent variable as the input.', fix: 'Ask which quantity changes freely — that is always x. The dependent variable (y) goes alone on the left side: y = [rate] × x.', prompt: 'Student work: Independent variable: total distance (d) Dependent variable: hours driven (h) Equation: h = 8 × d (WRONG) A bicycle travels 8 miles per hour. The student above analyzed the situation. Identify the error and write the correct equation.' },
    { label: 'Mistake B', wrong: 'Calling the output variable "independent" because it sounds more important or self-contained.', fix: 'Independent means it changes on its own — not that it is more important. Hours, distance, or items chosen freely by the user are the independent variables.', prompt: null },
  ],
  '6.G.A.1': [
    { label: 'Mistake A', wrong: 'Student uses A = b x h (parallelogram formula) for a triangle, forgetting the 1/2 factor — common error when switching between shape types on the same assignment.', fix: 'A triangle is exactly HALF of a parallelogram with the same base and height. The formula is A = 1/2 x b x h. Always check: is this a triangle? If yes, multiply by 1/2.', prompt: null },
    { label: 'Mistake B', wrong: 'Student uses the slant side (hypotenuse or oblique side) of a triangle or parallelogram as the height instead of the perpendicular distance from base to opposite vertex.', fix: 'Height must be perpendicular (90°) to the base. Draw a dashed line from the base straight up to the opposite vertex — that vertical distance is the height, not the slant side.', prompt: null },
  ],
  '6.G.A.2': [
    { label: 'Mistake A', wrong: 'Student multiplies mixed numbers digit by digit: 2 1/2 x 3 computed as "2 x 3 = 6, then add 1/2 = 6.5" instead of converting to 5/2 first and getting 7.5.', fix: 'Convert ALL mixed numbers to improper fractions FIRST: 2 1/2 = 5/2. Then multiply as a single fraction: 5/2 x 3 = 15/2 = 7.5. Never split a mixed number mid-computation.', prompt: null },
    { label: 'Mistake B', wrong: 'Student uses only B (one edge length) instead of B = l x w (base AREA) in V = B x h, multiplying just one dimension by h.', fix: 'In V = B x h, B is BASE AREA — a two-factor product for rectangular prisms: B = l x w. Always compute B = l x w first, then multiply by h.', prompt: null },
  ],
  '6.G.A.3': [
    { label: 'Mistake A', wrong: 'Adding coordinates (x + y) or (x₂ + x₁) to find a side length.', fix: 'Side length uses subtraction: |x₂ − x₁| for horizontal or |y₂ − y₁| for vertical sides.', prompt: 'A student found the perimeter of rectangle ABCD where A(1,2), B(5,2), C(5,6), D(1,6). Student\'s work: AB = |5 − 1| = 4 units BC = |6 − 2| = 4 units Perimeter = 4 + 4 = 8 units Find the error. Then find the correct perimeter.' },
    { label: 'Mistake B', wrong: 'Computing the perimeter by adding only two sides of the quadrilateral.', fix: 'A quadrilateral has four sides. Add all four side lengths to find the perimeter.', prompt: 'A student found the perimeter of hexagon ABCDEF where A(0,0), B(4,0), C(4,2), D(2,2), E(2,4), F(0,4). Student\'s work: AB = |4 − 0| = 4; BC = |2 − 0| = 2; CD = |4 − 2| = 2 DE = |4 − 2| = 2; EF = |2 − 0| = 2 Perimeter = 4 + 2 + 2 + 2 + 2 = 12 units Find the error. Then find the correct perimeter.' },
    { label: 'Mistake C', wrong: 'Trying to find a diagonal side length by subtracting one pair of coordinates.', fix: 'Coordinate subtraction only works for H or V sides. A diagonal requires the Pythagorean theorem, which is a later skill.', prompt: null },
    { label: 'Mistake D', wrong: 'Counting only 4 sides on an L-shaped hexagon and missing 2 of the 6 sides.', fix: 'Trace around the polygon step by step. An L-shaped hexagon has 6 sides — list each one before adding.', prompt: null },
  ],
  '6.G.A.4': [
    { label: 'Mistake A', wrong: 'Student counts only 5 faces for a rectangular prism (box), missing the hidden bottom face, leading to an SA that is too small by one face area.', fix: 'A rectangular prism ALWAYS has 6 faces — 3 congruent pairs (top/bottom, front/back, left/right). Use SA = 2lw + 2lh + 2wh to ensure all 3 pairs are counted.', prompt: null },
    { label: 'Mistake B', wrong: 'Student confuses volume and surface area, multiplying all 3 dimensions (V = l x w x h) to find "surface area," giving an answer in cubic units instead of square units.', fix: 'Surface area = sum of face AREAS (square units). Volume = 3D space inside (cubic units). For SA: find the area of each face, then add. Check: the answer must be in square units (cm², ft²).', prompt: null },
  ],
  '6.NS.A.1': [
    { label: 'Mistake A', wrong: 'Flipping the dividend (first fraction) instead of the divisor', fix: 'Always keep the first fraction exactly as written; flip ONLY the divisor (second fraction).', prompt: 'Maria says 5/6 ÷ 1/2 = 5/12 because she multiplied straight across. Devon says 5/6 ÷ 1/2 = 5/3 because he flipped the divisor first. Who is correct? What mistake did the other student make?' },
    { label: 'Mistake B', wrong: 'Thinking dividing by a fraction less than 1 gives a smaller result', fix: 'Dividing by a fraction less than 1 makes the quotient LARGER — more pieces fit into the dividend.', prompt: null },
  ],
  '6.NS.B.2+B.3': [
    { label: 'Mistake A', wrong: 'Counted decimal places in only one factor when multiplying — 4.5 × 2.8: moved 1 decimal place and got 126 instead of 12.6.', fix: 'Count decimal places in BOTH factors and ADD them — 4.5 (1 place) × 2.8 (1 place) = 2 total places → 12.6.', prompt: null },
    { label: 'Mistake B', wrong: 'Did not align decimal points when subtracting — computed 14.3 − 9.75 as 14.30 − 9.75 but borrowed incorrectly, getting 5.45 instead of 4.55.', fix: 'Line up the decimal points, write 14.30 − 9.75, then borrow column by column from right to left — answer is 4.55.', prompt: null },
  ],
  '6.NS.B.4': [
    { label: 'Mistake A', wrong: 'Stopped too early — GCF(12, 18) = 3 because that was the first common factor found.', fix: 'List ALL common factors before choosing — 1, 2, 3, 6 are all common factors of 12 and 18, so GCF = 6.', prompt: null },
    { label: 'Mistake B', wrong: 'Said GCF(6, 18) = 36 because "both 6 and 18 divide into 36."', fix: 'A factor must DIVIDE INTO both numbers — it cannot be larger than either. 36 > 6, so 36 cannot be a factor of 6. GCF = 6.', prompt: null },
    { label: 'Mistake C', wrong: 'Said LCM(4, 6) = 24 by just multiplying 4 × 6 — found a common multiple but not the LEAST one.', fix: 'List multiples of each number to find the FIRST match — LCM(4, 6) = 12, which is less than 4 × 6 = 24.', prompt: null },
    { label: 'Mistake D', wrong: 'Used lowest power instead of highest in prime factorization — LCM(4, 9): wrote 2¹ × 3¹ = 6 instead of 2² × 3² = 36.', fix: 'Take each prime at its HIGHEST power across all numbers — 4 = 2², 9 = 3², so LCM = 2² × 3² = 4 × 9 = 36.', prompt: null },
  ],
  '6.NS.C.5+C.6a': [
    { label: 'Mistake A', wrong: 'A student writes the opposite of −8 as −8, reasoning that the negative sign stays when finding an opposite.', fix: 'Taking the opposite always changes the sign: the opposite of −8 is +8.', prompt: null },
    { label: 'Mistake B', wrong: 'A student simplifies −(−6) as −6, applying the multiplication rule that two negatives make a negative.', fix: '−(−n) means taking the opposite, not multiplying. The opposite of −6 is +6, so −(−6) = 6.', prompt: null },
  ],
  '6.NS.C.6b': [
    { label: 'Mistake A', wrong: 'Reading (x, y) as (y, x) — placing the point at the reversed location', fix: 'x is always first: move horizontally (left/right) for x, then vertically (up/down) for y.', prompt: 'A student reflected (−3, 6) across the y-axis and wrote (−3, −6) as the image. The student flipped the sign of y instead of x. Find the correct image and explain the error.' },
    { label: 'Mistake B', wrong: 'Thinking any point with negative coordinates is in Quadrant III', fix: 'The quadrant depends on BOTH signs: (−, +) → Quadrant II; (−, −) → Quadrant III.', prompt: null },
  ],
  '6.NS.C.6c': [
    { label: 'Mistake A', wrong: 'Student counts tick marks instead of intervals when plotting 3/4 on a 4-part axis, placing the dot at 1 (the 4th tick) instead of the 3rd tick.', fix: 'The denominator tells how many equal PARTS (intervals), not how many ticks. 3/4 means 3 of 4 parts — place the dot at the 3rd tick, not the 4th.', prompt: 'A student plots 3/4 on a number line divided into 4 equal parts from 0 to 1. The student counts 4 tick marks and places the dot at 1. Find the error and write the correct position. The student wrote: "The denominator is 4, so I count 4 ticks and land at the 4th tick = 1."' },
    { label: 'Mistake B', wrong: 'Student plots (3, −2) by moving DOWN 2 first, then RIGHT 3, reversing the x-y movement order.', fix: 'Always move HORIZONTAL (x) first, then VERTICAL (y). For (3, −2): move RIGHT 3 from the origin, then DOWN 2.', prompt: 'A student plots (3, −2) by moving DOWN 2 first, then RIGHT 3. Is this method correct? If not, identify the error and describe the correct approach. The student wrote: "I moved y = −2 first (down 2), then x = 3 (right 3). The point is at (3, −2)."' },
  ],
  '6.NS.C.7': [
    { label: 'Mistake A', wrong: 'Comparing digits of negatives — writing −8 > −3 because 8 > 3', fix: 'Ignore digits alone. Place both on a number line: −3 is farther RIGHT than −8, so −3 > −8.', prompt: 'A student compares −8 and −3. She writes −8 > −3 because 8 > 3. The student compared the absolute values, ignoring the negative signs. Identify the error and write the correct inequality.' },
    { label: 'Mistake B', wrong: 'Assuming order and absolute value always agree: if −9 < −5 then |−9| < |−5|', fix: 'Order and absolute value can point opposite ways for negatives. −9 < −5 in order, but |−9| = 9 > |−5| = 5.', prompt: 'A student correctly writes −9 < −5 in order, then concludes |−9| < |−5| for the same reason. Identify the error and give the correct absolute value comparison.' },
  ],
  '6.NS.C.8': [
    { label: 'Mistake A', wrong: 'Student subtracts coordinates without absolute value and reports a negative distance.', fix: 'Distance is always positive. Use absolute value: |x₁ − x₂| or |y₁ − y₂|.', prompt: 'A student found the distance between A(5, −3) and B(5, 8). Her work: distance = 8 − (−3) = 8 − 3 = 5. What error did she make? Give the correct distance.' },
    { label: 'Mistake B', wrong: 'Student applies the shared-coordinate formula to points that do NOT share a coordinate.', fix: 'The shared-coordinate shortcut only works when both points share the same x OR the same y value.', prompt: null },
  ],
  '6.RP.A.1': [
    { label: 'Mistake A', wrong: 'Writing the ratio in reversed order — e.g., 4:3 when "3 cats to 4 dogs" is asked.', fix: 'Write the first quantity NAMED first — the word order determines the ratio order.', prompt: null },
    { label: 'Mistake B', wrong: 'Using the other-group count as the denominator for a part-to-whole ratio.', fix: 'Part-to-whole uses the TOTAL of all groups combined, not just the other part.', prompt: null },
  ],
  '6.RP.A.2': [
    { label: 'Mistake A', wrong: 'Dividing second ÷ first instead of first ÷ second to find the unit rate.', fix: 'Always divide first ÷ second. 120 miles in 3 hours → 120 ÷ 3 = 40 mph.', prompt: 'A student finds the unit rate for 120 miles in 3 hours by calculating 3 ÷ 120 = 0.025. Find the error and correct it. Student\'s Work: Divide: 3 ÷ 120 = 0.025 Unit rate: 0.025 miles per hour' },
    { label: 'Mistake B', wrong: 'Giving just a number without units — writing "40" instead of "40 miles per hour."', fix: 'Always label the unit rate with its units. The units tell what each 1 of represents.', prompt: null },
  ],
  '6.RP.A.3': [
    { label: 'Mistake A', wrong: 'Scaled 2:3 by adding 4 to each term to get 6:7', fix: 'Multiply BOTH terms by 4: 2 x 4 = 8, 3 x 4 = 12. Adding changes the ratio relationship.', prompt: null },
    { label: 'Mistake B', wrong: 'To find 30% of 60, divide 60 ÷ 30 = 2', fix: 'Percent means per 100: write 30/100, then multiply by the whole: 30/100 x 60 = 18.', prompt: null },
  ],
  '6.SP.A.1': [
    { label: 'Mistake A', wrong: 'Any question that uses numbers or data is a statistical question', fix: 'A question is statistical only when answers VARY across a group — not just any data.', prompt: null },
    { label: 'Mistake B', wrong: '"How many students are in our class?" is statistical because it counts a group', fix: 'Class size is one fixed number — variability (different answers), not group size, makes a question statistical.', prompt: null },
  ],
  '6.SP.A.2': [
    { label: 'Mistake A', wrong: 'A dot plot with a long tail on the right side is called skewed left', fix: 'Skew is named for the TAIL direction — tail pointing right = skewed right.', prompt: null },
    { label: 'Mistake B', wrong: 'A data set has no spread if the center is a single number', fix: 'Center and spread are different features — spread is the range from lowest to highest, regardless of what the center is.', prompt: null },
  ],
  '6.SP.A.3': [
    { label: 'Mistake A', wrong: 'A student claims two data sets with the same mean are identical because their centers match.', fix: 'Equal means do not guarantee equal spread — always check the range to assess variation.', prompt: null },
    { label: 'Mistake B', wrong: 'A student labels the range as a measure of center because it summarizes the data in one number.', fix: 'The range measures variation (spread), not center — it tells how spread out, not what is typical.', prompt: null },
  ],
  '6.SP.B.4': [
    { label: 'Mistake A', wrong: 'Counting the number of bars in a histogram to find total data values', fix: 'Each bar shows how many values are in that interval — add ALL bar heights to count total values.', prompt: 'Use the box plot of race times (seconds). A student says the faster runners (min to median) are more spread out than the slower runners (median to max). Is the student correct? Explain using the plot values.' },
    { label: 'Mistake B', wrong: 'Thinking a longer section of a box plot means more data points are there', fix: 'Every section holds the same 25% of the data; a longer section means more SPREAD, not more points.', prompt: 'A student says this histogram shows 3 values in all — one per bar. Student\'s Work: "I count 3 bars, so there are 3 values." Find the error and give the correct total count.' },
  ],
  '6.SP.B.5': [
    { label: 'Mistake A', wrong: 'Computing the IQR as max minus min (the range) instead of Q3 minus Q1.', fix: 'IQR = Q3 − Q1. It measures the spread of the middle half, not the full range.', prompt: null },
    { label: 'Mistake B', wrong: 'Always using mean and MAD even when data is skewed or has outliers.', fix: 'Outliers pull the mean. When data is skewed or has outliers, use median and IQR instead.', prompt: null },
  ],
  '7.EE.A.1': [
    { label: 'Mistake A', wrong: 'Combines unlike terms: writes 5x + 3 as 8x.', fix: 'Only combine same-variable terms; the 3 stays: 5x + 3.', prompt: null },
    { label: 'Mistake B', wrong: 'Drops the coefficient of 1: writes x + 4x as 4x.', fix: 'x means 1x, so x + 4x = 1x + 4x = 5x.', prompt: null },
    { label: 'Mistake C', wrong: 'Distributes to the first term only: 3(x + 4) = 3x + 4.', fix: 'Multiply the factor by EACH term: 3(x + 4) = 3x + 12.', prompt: null },
    { label: 'Mistake D', wrong: 'Sign error with a negative factor: -2(x - 5) = -2x - 10.', fix: 'A negative times a negative is positive: -2(x - 5) = -2x + 10.', prompt: null },
  ],
  '7.EE.A.2': [
    { label: 'Mistake A', wrong: 'Combines unlike terms: writes 3x + 4 as 7x.', fix: 'Only combine same-variable terms. 3x and 4 are unlike.', prompt: null },
    { label: 'Mistake B', wrong: 'Distributes to the first term only: 3(x + 4) gives 3x + 4.', fix: 'Multiply the factor by EVERY term: 3(x + 4) = 3x + 12.', prompt: null },
  ],
  '7.EE.B.3': [
    { label: 'Mistake A', wrong: 'Adds instead of subtracts when a quantity is lost, dropped, or described as negative.', fix: 'A loss of 4.7 means adding -4.7, not +4.7. Restate: the value decreases by 4.7.', prompt: 'Maya computes the net change: a temperature starts at -5.6 degrees, then gains 2.3 degrees, then loses 4.7 degrees. Maya’s work: -5.6 + 2.3 = -3.3 -3.3 + 4.7 = 1.4 degrees Identify Maya’s error and show the correct solution.' },
    { label: 'Mistake B', wrong: 'Subtracts mixed numbers without regrouping when the fraction part is smaller.', fix: 'Regroup: 3 1/4 - 1 3/4 → rewrite 3 1/4 as 2 5/4, then subtract to get 1 2/4 = 1 1/2.', prompt: 'Liam subtracts: 3 1/4 - 1 3/4. Liam’s work: 3 1/4 - 1 3/4 Whole parts: 3 - 1 = 2 Fraction parts: 3/4 - 1/4 = 2/4 Answer: 2 2/4 = 2 1/2 Identify Liam’s error and show the correct solution.' },
  ],
  '7.EE.B.4a': [
    { label: 'Mistake A', wrong: 'Divides before undoing the constant term.', fix: 'Undo + or - first, then divide to isolate x.', prompt: null },
    { label: 'Mistake B', wrong: 'Distributes p(x + q) to the first term only.', fix: 'Multiply the factor by BOTH terms inside.', prompt: null },
  ],
  '7.EE.B.4b': [
    { label: 'Mistake A', wrong: 'Divides by negative but forgets to flip the sign.', fix: 'Divide by a negative — REVERSE the inequality sign.', prompt: null },
    { label: 'Mistake B', wrong: 'Solves correctly but shades in the wrong direction.', fix: 'x > n or ≥ n: shade right. x < n or ≤ n: shade left.', prompt: null },
  ],
  '7.G.A.1': [
    { label: 'Mistake A', wrong: 'Priya: 6 cm² × 5 = 30 m² (k applied to area).', fix: 'Find sides first: 15 m × 10 m; area = 150 m².', prompt: 'Priya says the actual area of a 3 cm × 2 cm drawing at scale 1 cm = 5 m is 30 m² because 6 cm² × 5 = 30 m². Find her error and correct it.' },
    { label: 'Mistake B', wrong: 'Marcus: 6 ÷ 4 = 1.5 m (divided instead of ×).', fix: 'Multiply: 6 × 4 = 24 m. drawing × scale = actual.', prompt: 'Marcus finds the actual length of a 6 cm drawing at scale 1 cm = 4 m by computing 6 ÷ 4 = 1.5 m. Find his error and correct it.' },
  ],
  '7.G.A.2': [
    { label: 'Mistake A', wrong: 'Student tests only one pair and declares the triangle valid.', fix: 'All three pairs must pass — test a+b>c, a+c>b, AND b+c>a.', prompt: null },
    { label: 'Mistake B', wrong: 'Student treats a+b = c as a valid triangle.', fix: 'Equality means a flat, degenerate shape — the inequality must be STRICT.', prompt: null },
  ],
  '7.G.A.3': [
    { label: 'Mistake A', wrong: 'Believing every cross-section of a solid is the same as its base, no matter how it is cut.', fix: 'The cut DIRECTION matters. A vertical slice of a cylinder is a rectangle, not a circle. A vertical slice of a rectangular pyramid is a triangle, not a rectangle. Always check horizontal vs vertical first.', prompt: 'A cylinder is sliced vertically, straight down through its side. Rivera says: "The cross-section is a circle, because a cylinder has circles." Identify Rivera’s error and name the correct cross-section.' },
    { label: 'Mistake B', wrong: 'Confusing the 3D solid with the 2D cross-section — naming the solid instead of the slice shape.', fix: 'A cross-section is always a flat 2D shape: rectangle, triangle, circle, square, or trapezoid. Never answer "cylinder" or "pyramid" — those are the solids, not the slices.', prompt: 'A rectangular pyramid is sliced vertically through its apex. Tran says: "The cross-section is a rectangle, because the base is a rectangle." Identify Tran’s error and name the correct cross-section.' },
  ],
  '7.G.B.4': [
    { label: 'Mistake A', wrong: 'Using diameter instead of radius in the area formula: writing A=πd² instead of A=πr².', fix: 'The area formula A=πr² requires the RADIUS. For d=10, find r=5 first: A=π(5²)=π(25)=78.5, not π(100)=314. Using d gives an area 4 times too large.', prompt: 'A circle has a diameter of 12 cm. Rivera computes the area: "A=π×12²=π×144=452.16 cm²." Identify Rivera\'s error and find the correct area. Use π≈3.14.' },
    { label: 'Mistake B', wrong: 'Using the circumference formula for area: writing A=πr instead of A=πr².', fix: 'The area formula has an EXPONENT: A=πr². Circumference is C=πd or C=2πr. Area has r SQUARED. Write both formulas on your reference card and check which you need.', prompt: 'A circle has a radius of 5 cm. Tran computes the area: "A=π×r=π×5=15.7 cm²." Identify Tran\'s error and find the correct area. Use π≈3.14.' },
  ],
  '7.G.B.5': [
    { label: 'Mistake A', wrong: 'Student confuses complementary (90°) and supplementary (180°) — writes the wrong sum in the equation.', fix: 'Complementary = 90° (right angle). Supplementary = 180° (straight line). Identify the figure first.', prompt: null },
    { label: 'Mistake B', wrong: 'Student writes ∠1 = ∠2 for a linear pair — treats it as vertical angles instead of a sum equation.', fix: 'Linear pair angles are on the same straight line — write the SUM equation: ∠1 + ∠2 = 180°.', prompt: null },
  ],
  '7.G.B.6': [
    { label: 'Mistake A', wrong: 'Adding up all the side lengths and calling that the area, instead of decomposing and using area formulas.', fix: 'Area is not perimeter. Decompose the figure into rectangles and triangles, use A = l x w and A = 1/2 b h on each piece, then add the AREAS together.', prompt: 'A figure is a 10 cm by 6 cm rectangle with a 3 cm by 2 cm rectangle removed. Rivera says: "The area is 10 x 6 x 3 x 2 = 360 square centimeters." Identify Rivera’s error and find the correct area.' },
    { label: 'Mistake B', wrong: 'Counting all six faces of every prism when two solids are joined face to face.', fix: 'Where two solids meet, the touching faces are hidden and are NOT part of the surface area. Count only the faces you could see or touch from the outside.', prompt: 'Two cubes are glued face to face to make one solid. Each cube has 6 faces. Tran says: "The surface area shows 12 faces." Identify Tran’s error and find how many faces actually show.' },
  ],
  '7.NS.A.1a': [
    { label: 'Mistake A', wrong: 'Confuses the additive inverse with absolute value — writes the additive inverse of −8 as −8 (reasoning that the absolute value already has a sign), rather than +8.', fix: 'The additive inverse changes the sign. The additive inverse of −8 is +8, not −8, because (−8) + 8 = 0. Verify: if the sum is not 0, the inverse is wrong.', prompt: 'Rivera says the additive inverse of −9 is also −9, because the absolute value of −9 is 9, and since there is already a negative sign, the inverse keeps the sign. Rivera\'s work: Additive inverse of −9 → |−9| = 9 → keep the negative sign → −9 Identify Rivera\'s error and find the correct additive inverse of −9.' },
    { label: 'Mistake B', wrong: 'Claims that two identical numbers like −3 and −3 are additive inverses because they have the same absolute value — confusing "same absolute value" with "additive inverse."', fix: 'Additive inverses must sum to 0. (−3) + (−3) = −6, not 0. The additive inverse of −3 is +3, because (−3) + 3 = 0. Opposite signs, same distance from 0.', prompt: 'Tran says that −3 and −3 are additive inverses because they both have the same absolute value of 3 and the same sign. Tran\'s work: |−3| = 3 and |−3| = 3 → same absolute value and same sign → additive inverses Identify Tran\'s error and name the correct additive inverse of −3.' },
  ],
  '7.NS.A.1b': [
    { label: 'Mistake A', wrong: 'Added |values| on unlike signs: −9 + 5 → 9 + 5 = 14, so −14', fix: 'Unlike signs subtract: 9−5=4; |−9|>|5| gives −4', prompt: 'Jamal says −9 + 5 = −14. Find his mistake, then show the correct sum using the SUMS rules.' },
    { label: 'Mistake B', wrong: 'Correct subtraction, wrong sign: 11 − 4 = 7, so answer is 7', fix: '|−11| > |4|, so the answer must be negative: −11 + 4 = −7', prompt: 'Keisha says −11 + 4 = 7. Her subtraction 11 − 4 = 7 is correct, but her answer is wrong. Explain why, and give the correct sum.' },
  ],
  '7.NS.A.1c': [
    { label: 'Mistake A', wrong: 'Did not add the opposite: (−6) − (−4) = −10', fix: 'Add the opposite — (−6) + 4 = −2 (Keep, Change, Change)', prompt: 'Devon says (−6) − (−4) = −10. Find his mistake, then show the correct work using KCC.' },
    { label: 'Mistake B', wrong: 'Changed the operation but not the second sign: 7 − (−5) = 2', fix: 'Change BOTH: 7 + 5 = 12 — keep, change, change.', prompt: 'Mara says 7 − (−5) = 2. She changed subtraction to addition but her answer is still wrong. Explain what she forgot, and give the correct difference.' },
  ],
  '7.NS.A.1d': [
    { label: 'Mistake A', wrong: 'Adding tops and bottoms: 1/4 + 2/3 = 3/7', fix: 'Denominators never add — find the LCD first: 3/12 + 8/12 = 11/12', prompt: 'Noah says 1/4 + 2/3 = 3/7 because "you add the tops and add the bottoms." Find his mistake, then show the correct work.' },
    { label: 'Mistake B', wrong: 'Subtracting a negative still subtracts: 3/5 − (−1/5) = 2/5', fix: 'KCC changes BOTH signs: 3/5 + 1/5 = 4/5 — subtracting a negative ADDS', prompt: 'Mia says 3/5 − (−1/5) = 2/5 because "subtracting makes it smaller." Explain her error, then give the correct answer.' },
  ],
  '7.NS.A.2a': [
    { label: 'Mistake A', wrong: 'Two negatives make a negative product: (−3) × (−7) = −21', fix: 'Same signs ALWAYS give a positive product: (−3) × (−7) = +21', prompt: 'Theo says (−3) × (−7) = −21 because "two negatives stay negative." Find his mistake, then show the correct work using MAPS.' },
    { label: 'Mistake B', wrong: 'The bigger factor sets the sign: (−4) × 7 = +28', fix: 'The ADDITION rule — products only ask if signs match: −28', prompt: 'Lena says (−4) × 7 = 28 because "7 is bigger than 4, so the answer is positive." Explain her error, then give the correct product.' },
  ],
  '7.NS.A.2b': [
    { label: 'Mistake A', wrong: 'Two negatives make a negative quotient: (−42) ÷ (−6) = −7', fix: 'Same signs ALWAYS give a positive quotient: (−42) ÷ (−6) = +7', prompt: 'Mara says (−42) ÷ (−6) = −7 because "the negatives stay negative." Find her mistake, then show the correct work using MAPS.' },
    { label: 'Mistake B', wrong: 'You can divide by zero: 9 ÷ 0 = 0', fix: '0 ÷ 9 = 0, but 9 ÷ 0 is UNDEFINED — no number times 0 makes 9', prompt: 'Jonah says 0 ÷ 9 = 0 and 9 ÷ 0 = 0 because "anything with zero is zero." One statement is wrong. Explain which one, then give the correct value of each expression.' },
  ],
  '7.NS.A.2c': [
    { label: 'Mistake A', wrong: 'Multiplying mixed numbers in pieces: 2 1/2 × 3 = 6 1/2', fix: 'Convert first: 2 1/2 = 5/2, so 5/2 × 3 = 15/2 = 7 1/2', prompt: 'Leo says 2 1/2 × 3 = 6 1/2 because "2 × 3 = 6, and the 1/2 just comes along." Find his mistake, then show the correct work.' },
    { label: 'Mistake B', wrong: 'Flipping the first fraction: (1/2) ÷ (3/4) = (2/1) × (3/4)', fix: 'KEEP the first — FLIP the divisor: (1/2) × (4/3) = 2/3', prompt: 'Ava evaluates (−1/2) ÷ (3/4) by flipping the first fraction: (−2/1) × (3/4) = −3/2. Find her mistake, then show the correct work using KCF.' },
  ],
  '7.NS.A.2d': [
    { label: 'Mistake A', wrong: 'Moving the point one place: 0.45 = 4.5%', fix: 'Percent means per 100 — shift TWO places: 0.45 = 45%', prompt: 'Marcus converts 0.45 to a percent and writes 0.45 = 4.5% because "you move the decimal point one place." Find his mistake, then show the correct conversion.' },
    { label: 'Mistake B', wrong: 'Stopping the division early: 1/3 = 0.3 exactly', fix: '1 ÷ 3 never ends — bar the repeat: 0.333…', prompt: 'Jada divides 1 ÷ 3, stops after one digit, and writes 1/3 = 0.3 exactly. Find her mistake, then write the true decimal form of 1/3.' },
  ],
  '7.NS.A.3': [
    { label: 'Mistake A', wrong: 'Adds instead of multiplying for rate-times-time or scale problems — treats "3/4 mile per hour for 2 2/3 hours" as an addition situation rather than recognizing that rate × time = total.', fix: 'Rate × time = total distance or total amount. "Per hour for 2 hours" signals multiplication. Verify: 3/4 × 2 2/3 = 2 miles, not 3/4 + 2 2/3 = 3 5/12 miles.', prompt: 'Rivera is finding the total descent of a submarine that travels at 3/4 mile per hour for 2 2/3 hours. Rivera\'s work: 3/4 + 2 2/3 = 9/12 + 32/12 = 41/12 miles (approximately 3.4 miles) Identify Rivera\'s error and find the correct total descent.' },
    { label: 'Mistake B', wrong: 'Computes the correct magnitude but drops the negative sign — reports the absolute value (e.g., 6.25) instead of the signed result (−6.25) because the negative "seems wrong."', fix: 'A negative answer is correct when the situation calls for it: a drop below zero, a debt, a descent. Always connect the sign back to the context before writing the final answer.', prompt: 'Tran is finding the final temperature after a thermometer reads 4.2°F and the temperature drops 1.8°F each day for 3 days. Tran\'s work: 4.2 + 3 × 1.8 = 4.2 + 5.4 = 9.6°F Identify Tran\'s error and find the correct final temperature.' },
  ],
  '7.RP.A.1': [
    { label: 'Mistake A', wrong: 'Divides the second quantity by the first, inverting the rate.', fix: 'Divide first ÷ second: 180 miles ÷ 4 hours = 45 mph, not 4 ÷ 180.', prompt: null },
    { label: 'Mistake B', wrong: 'Stops at the ratio without simplifying to a per-ONE rate.', fix: 'Divide all the way: 180:4 becomes 45:1, so the unit rate is 45.', prompt: null },
  ],
  '7.RP.A.2': [
    { label: 'Mistake A', wrong: 'Flipping the ratio: k = x ÷ y instead of y ÷ x', fix: 'k = y ÷ x — divide the y-value by the x-value', prompt: 'A proportional table includes the pair (4, 28). Reza finds the constant by computing 4 ÷ 28 and writes k = 1/7. Find his mistake, then find the correct k and equation.' },
    { label: 'Mistake B', wrong: 'Adding instead of multiplying: 2 to 6 means add 4', fix: 'Proportions multiply: y is always k times x', prompt: 'A proportional relationship includes the pair (2, 6). Mia says (3, 7) must also belong to it, because she added 1 to each number. Find her mistake, then find the correct y-value for x = 3.' },
  ],
  '7.RP.A.3': [
    { label: 'Mistake A', wrong: 'Multiplies by the percent number instead of its decimal.', fix: 'Convert first: 25% = 0.25, then 0.25 × 80 = 20.', prompt: null },
    { label: 'Mistake B', wrong: 'Finds the increase but forgets to add it to the original.', fix: 'Increase means original + change, or just × (1 + rate).', prompt: null },
  ],
  '7.SP.A.1': [
    { label: 'Mistake A', wrong: 'A larger sample is always more reliable.', fix: 'Reliability depends on random selection, not just size. A large biased sample is still biased.', prompt: 'A reporter surveys the first 20 students to arrive at a school dance and concludes that most students enjoy school events. Rivera says the inference is valid because "20 students were asked, and 20 is a reasonable number to survey." Identify and correct Rivera\'s error.' },
    { label: 'Mistake B', wrong: 'Any sample taken from a population supports valid inferences.', fix: 'Only a random sample — where every member had an equal chance of selection — supports valid inferences.', prompt: 'A school places all 600 student names in a hat and randomly draws 30 names to survey about lunch preferences. Tran says the inference about all 600 students is not valid because "30 is only 5% of 600 students — too small a sample." Identify and correct Tran\'s error.' },
  ],
  '7.SP.A.2': [
    { label: 'Mistake A', wrong: 'The sample mean is the exact population mean.', fix: 'The sample mean estimates the population mean. Different samples give different means — the true population mean may vary slightly from any single sample.', prompt: 'A student generates 3 random samples (n = 5 each) to estimate the average daily fruit servings at school. Sample means: 1.8, 2.4, and 1.6 servings. Rivera says: "My three samples gave very different results — the range is 0.8 servings. This proves random sampling does not work, and I cannot make an inference." Identify and correct Rivera\'s error.' },
    { label: 'Mistake B', wrong: 'If two samples give different means, the sampling method failed.', fix: 'Variability across samples is normal and expected. Average multiple sample means for the best estimate of the population.', prompt: 'A class randomly surveys 30 students and finds the sample mean for nightly study time is 22 minutes. Tran writes: "The data shows students study exactly 22 minutes per night." Identify and correct Tran\'s error.' },
  ],
  '7.SP.B.3': [
    { label: 'Mistake A', wrong: 'A large center gap alone proves the two groups are clearly different.', fix: 'The center gap must be measured in MAD units. A gap of 10 points means little if MAD is also 10, but signals clear separation if MAD is only 2. Always divide the center gap by the MAD.', prompt: 'Two teams competed in a math relay. Team Blue scores: 10, 11, 13, 15, 16. Team Gold scores: 4, 5, 7, 9, 10. Rivera calculates the center gap and wants to express it as a multiple of a measure of variability. Rivera writes: "Team Blue mean = 13. Team Gold mean = 7. Center gap = 6. The range of Team Gold is 10-4 = 6, so the gap is 6 divided by 6 = 1 range unit. The teams scored about the same." Identify and correct Rivera\'s error.' },
    { label: 'Mistake B', wrong: 'Two distributions that share some range are automatically similar groups.', fix: 'Distributions can overlap visually yet still have very different centers. Always report BOTH the visual overlap description AND the MAD ratio for a complete comparison.', prompt: 'Two classes recorded hours of weekly screen time. Class P: mean=24 hours, MAD=6 hours. Class Q: mean=30 hours, MAD=6 hours. Tran writes: "The center gap is 30-24 = 6 hours. Six is a fairly big number, so Class Q has significantly more screen time than Class P - the distributions are clearly different." Identify and correct Tran\'s error.' },
  ],
  '7.SP.B.4': [
    { label: 'Mistake A', wrong: 'The population with the higher sample mean is always higher than the other population in every case.', fix: 'An informal comparative inference says one population is TYPICALLY higher — not always. Overlapping distributions mean some members of the lower-center group may still score above members of the higher-center group. Use "typically" or "tends to be," never "always."', prompt: 'Two 7th-grade classes each had 30 randomly selected students take a math assessment. Class A: mean=82 pts, MAD=10 pts. Class B: mean=75 pts, MAD=10 pts. Rivera writes: "Class A has a mean of 82 and Class B has a mean of 75. Class A is 7 points higher. Therefore, Class A students are always better at math than Class B students." Identify and correct Rivera\'s two errors.' },
    { label: 'Mistake B', wrong: 'Comparing means alone is enough to draw a valid comparative inference.', fix: 'Both center AND variability are required. A center gap of 6 means very different things when MAD=2 (3 MADs — clearly different) vs. MAD=12 (0.5 MADs — much overlap). Always express the center gap in MAD units before drawing an inference.', prompt: 'A researcher compared two groups on a science test using random samples. Group 1: mean=65 pts, MAD=3 pts. Group 2: mean=58 pts, MAD=8 pts. Tran writes: "Group 2 has a larger MAD (8 > 3), so Group 2\'s scores are typically higher than Group 1\'s scores." Identify Tran\'s error and write the correct inference.' },
  ],
  '7.SP.C.5': [
    { label: 'Mistake A', wrong: 'Thinks a bigger numerator alone means "more likely," ignoring the total (says 2/5 is more likely than 1/2).', fix: 'Compare each probability to the whole. Convert to decimals or a common form: 1/2 = 0.5 is greater than 2/5 = 0.4.', prompt: 'Dana says: "An event with probability 0 has a small chance of happening." Identify Dana’s error and write the correct meaning of a probability of 0.' },
    { label: 'Mistake B', wrong: 'Believes a probability of 0 means a small chance, or that a probability can be greater than 1.', fix: 'P = 0 means the event truly cannot happen, and no probability is ever above 1. Any value outside 0 to 1 is an error.', prompt: 'Eli ranks events by likelihood and writes: "P = 3/4 is less likely than P = 2/5 because 2/5 has the bigger top number." Identify Eli’s error and rank the two probabilities correctly.' },
  ],
  '7.SP.C.6': [
    { label: 'Mistake A', wrong: 'Uses the count of unfavorable outcomes as the denominator: P = favorable / unfavorable.', fix: 'The denominator must be the TOTAL — all trials or all possible outcomes, not just the ones that did not occur.', prompt: 'Maya is given data from 50 spinner trials: Red: 18 times, Blue: 22 times, Green: 10 times. She is asked to find the experimental probability of spinning red. Maya’s work: The spinner has 3 colors, so P(red) = 1/3. Identify Maya’s error and show the correct experimental probability.' },
    { label: 'Mistake B', wrong: 'Uses theoretical probability (from the sample space) when asked for experimental probability from the data table.', fix: 'Experimental probability reads from the actual data: count favorable trials and divide by total trials, regardless of the theoretical value.', prompt: 'Liam rolls a number cube 30 times. It lands on 3 exactly 7 times. Liam’s work: Threes: 7. Non-threes: 23. P(3) = 7/23 Identify Liam’s error and write the correct experimental probability.' },
  ],
  '7.SP.C.7': [
    { label: 'Mistake A', wrong: 'Assumes all outcomes are equally likely and assigns P = 1/n even when the problem is non-uniform or observed frequencies are unequal.', fix: 'Check whether the problem provides a uniform model (equal sections, fair coin/die) or observed data. If data is given, build a non-uniform model: P = frequency / total for each outcome.', prompt: 'Liam is building a probability model for a spinner. He observes 50 spins: Red appeared 25 times, Blue appeared 15 times, Green appeared 10 times. Liam’s work: There are 3 colors, so each color is equally likely. P(Red) = 1/3, P(Blue) = 1/3, P(Green) = 1/3. Identify Liam’s error and build the correct probability model from the observed data.' },
    { label: 'Mistake B', wrong: 'Assigns the raw count as the probability (P = 8) instead of the relative frequency (P = 8/20), so the model sums to more than 1.', fix: 'A valid probability must be between 0 and 1. Divide each count by the total number of observations to find relative frequency, then use that as the probability.', prompt: 'Maya observes 40 spins of a spinner and records: Section A appeared 8 times, Section B appeared 16 times, Section C appeared 16 times. Maya’s work: P(A) = 8, P(B) = 16, P(C) = 16 Maya says this is a valid model because she used the actual data. Identify Maya’s error and build the correct probability model.' },
  ],
  '7.SP.C.8': [
    { label: 'Mistake A', wrong: 'Builds an incomplete tree diagram or organized list, missing some outcome pairs, and uses too few total outcomes to compute P.', fix: 'Systematically list every combination: pair each first-event outcome with every second-event outcome. Total outcomes = (# first outcomes) x (# second outcomes). Count all paths before computing P.', prompt: 'Rivera uses a tree diagram to find the probability of drawing a Red tile and then a Blue tile from a bag of 3 tiles (Red, Blue, Yellow), drawn without replacement. Rivera\'s work: Tree: Red — Blue — Yellow (3 outcomes total) P(Red, then Blue) = 1/3 Identify Rivera\'s error and find the correct probability.' },
    { label: 'Mistake B', wrong: 'Treats a without-replacement (dependent) draw as independent, using the original full count for the second draw and getting a sample space that is too large.', fix: 'When items are drawn without replacement, reduce the available outcomes for the second draw by 1. List the new sample space: fewer outcomes are available after the first item is removed.', prompt: 'Tran draws 2 tiles from a bag containing 4 tiles (Red, Blue, Green, Yellow) without replacement and finds P(Red first, then Blue). Tran\'s work: The bag has 4 tiles, so the sample space has 4 x 4 = 16 outcomes. P(Red first, then Blue) = 1/16 Identify Tran\'s error and find the correct probability.' },
  ],
  '8.EE.A.1': [
    { label: 'Mistake A', wrong: 'Multiplying the exponents when multiplying same-base powers — writing x² · x³ = x⁶ instead of x⁵.', fix: 'The product rule ADDS the exponents: x² · x³ = x⁵. Multiplying exponents is the power-of-a-power rule — a different situation.', prompt: null },
    { label: 'Mistake B', wrong: 'Treating (x + y)² as x² + y² — distributing the exponent across addition.', fix: 'Distributing only works over MULTIPLICATION: (xy)² = x²y². With addition you must expand: (x + y)² = x² + 2xy + y².', prompt: null },
    { label: 'Mistake C', wrong: 'Writing x⁻³ = -x³ — treating the negative exponent as a negative sign on the value.', fix: 'A negative exponent means RECIPROCAL: x⁻³ = 1/x³. The value stays positive; only the position of the base changes.', prompt: null },
    { label: 'Mistake D', wrong: 'Writing x⁰ = 0 — reasoning that a 0 exponent makes the value zero.', fix: 'The descending pattern forces x⁰ = 1: x² ÷ x = x¹, then x¹ ÷ x = x⁰ = 1. A zero exponent gives 1, not 0.', prompt: null },
  ],
  '8.EE.A.2': [
    { label: 'Mistake A', wrong: 'Reading √49 as 24.5 by taking half of 49.', fix: 'A square root is not half. √49 = 7 because 7² = 49.', prompt: null },
    { label: 'Mistake B', wrong: 'Splitting a root over addition: √(4+9) = √4 + √9.', fix: 'Roots do not distribute. Add under the radical first: √(4+9) = √13 ≈ 3.61.', prompt: null },
  ],
  '8.EE.A.3': [
    { label: 'Mistake A', wrong: 'Counting zero digits instead of counting decimal places moved — for 0.0050, two leading zeros suggest 10⁻², but the decimal moves 3 places right to reach 5.0 × 10⁻³.', fix: 'Count the number of places the decimal MOVES until one non-zero digit sits before it. That move count, not the zero count, is |n|.', prompt: null },
    { label: 'Mistake B', wrong: 'Reading 4.7 × 10⁻³ as a negative number (−4,700) because the exponent is negative.', fix: 'A negative exponent means a SMALL positive number. 4.7 × 10⁻³ = 0.0047 — the negative tells which direction the decimal moves, not the sign of the result.', prompt: null },
  ],
  '8.EE.A.4': [
    { label: 'Mistake A', wrong: 'Adding both the coefficients AND the exponents of (3 × 10⁵) + (4 × 10³), writing 7 × 10⁸ — treating add/subtract like multiply.', fix: 'Add/subtract requires equal powers of 10 first. Rewrite 4 × 10³ as 0.04 × 10⁵, then add coefficients: 3.04 × 10⁵.', prompt: null },
    { label: 'Mistake B', wrong: 'Leaving a result like 30 × 10⁷ or 0.3 × 10¹⁰ as the final answer when the coefficient is outside 1 ≤ |c| < 10.', fix: 'Renormalize: slide the decimal so 1 ≤ |c| < 10 and adjust the exponent. 30 × 10⁷ = 3.0 × 10⁸.', prompt: null },
  ],
  '8.EE.B.5': [
    { label: 'Mistake A', wrong: 'Dividing x by y instead of y by x — computing k = x / y returns the reciprocal, not k.', fix: 'k = y / x: the output variable (y) is always the numerator. Divide y by x, not x by y.', prompt: 'A student claims y = 3x + 2 is a proportional relationship because the graph is a straight line and has x in the equation. Identify the student\'s error. Explain how to check whether a relationship is proportional.' },
    { label: 'Mistake B', wrong: 'Calling y = 3x + 2 proportional because it has y = kx structure with a coefficient visible.', fix: 'Substitute x = 0: y = 2, not 0. The graph misses the origin — proportional requires y = 0 when x = 0.', prompt: null },
  ],
  '8.EE.B.6': [
    { label: 'Mistake A', wrong: 'Reading the y-intercept off the x-axis — plotting (b, 0) instead of (0, b).', fix: 'The y-intercept is always on the y-axis where x = 0. Plot (0, b), not (b, 0).', prompt: 'A student graphs y = 3x + 5 by plotting (5, 0) first, then counting up 3 and right 1 to a second point. Their graph is incorrect. Identify the error. Describe the correct first step.' },
    { label: 'Mistake B', wrong: 'Swapping rise and run — moving horizontally first, then vertically.', fix: 'Slope = rise ÷ run: vertical change first, horizontal second.', prompt: null },
  ],
  '8.EE.C.7a': [
    { label: 'Mistake A', wrong: 'Variables cancel to 15 = 14, and a student writes x = 15 − 14 = 1 as the answer.', fix: 'When variable terms cancel, there is no x to isolate. The remaining statement is 15 ≠ 14 (false), so the answer is No Solution — not x = 1.', prompt: 'Alex solved 5(x + 3) = 5x + 14. [Alex\'s work] 5x + 15 = 5x + 14 15 = 14 x = 15 − 14 = 1 Describe Alex\'s error and state the correct answer.' },
    { label: 'Mistake B', wrong: 'Distributing 3(x + 2) as 3x + 2 (only first term) and reaching the wrong solution type.', fix: 'Distribute to EVERY term inside: 3(x + 2) = 3x + 6, not 3x + 2. An incorrect distribution changes the solution type entirely.', prompt: null },
  ],
  '8.EE.C.7b': [
    { label: 'Mistake A', wrong: 'Multiplying only the variable term by the reciprocal — for example, writing (1/2)x + 4 = 7 → x + 4 = 14 instead of x + 8 = 14.', fix: 'Multiply EVERY term on both sides by the LCD or reciprocal.', prompt: null },
    { label: 'Mistake B', wrong: 'Using the original fraction instead of its reciprocal — writing x = 6 × (3/4) instead of x = 6 × (4/3).', fix: 'The reciprocal of a/b is b/a — flip numerator and denominator to clear the coefficient.', prompt: null },
    { label: 'Mistake C', wrong: 'Writing an expression for only one quantity instead of the equation for the combined condition — for example, writing "2k + 3 = 39" when "combined they have 39" means both together.', fix: 'Read the entire problem: the equation must represent the combined condition, not just one person\'s count.', prompt: null },
    { label: 'Mistake D', wrong: 'Skipping the variable definition — writing an equation without stating what the variable represents, then solving for the wrong quantity.', fix: 'Write "Let ___ = ___" first. The variable must name something specific from the problem context.', prompt: null },
  ],
  '8.EE.C.8+C.8b': [
    { label: 'Mistake A', wrong: 'Substituting back into the SAME equation, which gives a useless true statement like 9 = 9.', fix: 'Always substitute the expression into the OTHER equation.', prompt: null },
    { label: 'Mistake B', wrong: 'Dropping parentheses around a multi-term expression, so the sign of the second term is wrong.', fix: 'Wrap the substituted expression in parentheses, then distribute.', prompt: null },
    { label: 'Mistake C', wrong: 'Multiplying only the variable terms when scaling — for example, writing 2(x + 3y = 5) as 2x + 3y = 10 instead of 2x + 6y = 10.', fix: 'Multiply EVERY term including the constant on the right side by the same number.', prompt: null },
    { label: 'Mistake D', wrong: 'Choosing the wrong operation — adding when coefficients are equal (same sign), or subtracting when signs are opposite.', fix: 'Equal signs → SUBTRACT. Opposite signs → ADD. Ask: which operation makes one variable cancel?', prompt: null },
  ],
  '8.EE.C.8a': [
    { label: 'Mistake A', wrong: 'Writing the intersection as (y, x) — reversing the coordinates.', fix: 'The horizontal axis is x, so the x-coordinate always comes first: write (x, y).', prompt: 'A student solved the system y = 2x − 1 and y = −x + 5 by setting 2x − 1 = −x + 5 and got x = 2, y = 3. The student wrote the answer as (3, 2). Find and fix the student\'s error.' },
    { label: 'Mistake B', wrong: 'Assuming every system must have a solution.', fix: 'Same slope + different y-intercepts = parallel lines = no solution. Check slopes first.', prompt: null },
  ],
  '8.EE.C.8c': [
    { label: 'Mistake A', wrong: 'Writing only one equation from the word problem instead of two separate constraints.', fix: 'Identify every condition stated in the problem — each independent condition becomes its own equation.', prompt: null },
    { label: 'Mistake B', wrong: 'Stopping at the ordered-pair solution without connecting it to the problem context.', fix: 'Write a complete sentence using the variable definitions to interpret each value after solving.', prompt: null },
  ],
  '8.F.A.1': [
    { label: 'Mistake A', wrong: 'Thinking a relation is not a function when two inputs share the same output (e.g., (1,4) and (2,4)).', fix: 'Outputs CAN repeat. The test is inputs only — each input must pair with exactly one output.', prompt: 'Tyler examines the mapping: 1→4, 2→4, 3→8. Tyler writes: "Output 4 appears twice, so this is NOT a function." Identify Tyler\'s error and state the correct answer with justification.' },
    { label: 'Mistake B', wrong: 'Confusing which column is the input and which is the output in a table or mapping diagram.', fix: 'The input (x) is always the independent variable — the left column in a table or left side of a mapping.', prompt: null },
  ],
  '8.F.A.2': [
    { label: 'Mistake A', wrong: 'Reading slope from a table as the y-value when x=1 rather than computing Δy÷Δx.', fix: 'Slope from a table = Δy÷Δx between any two rows. The value at x=1 is NOT the slope.', prompt: 'Marcus compared f(x)=2x+6 and g(x), shown by a graph through (0,4) with slope 5. Marcus said: "f(x) starts at 2 because 2 is its coefficient." Identify Marcus’s error and state the correct initial value for each function.' },
    { label: 'Mistake B', wrong: 'Assuming the function with the larger coefficient has the greater slope without checking the form.', fix: 'Extract slope from each form first — m in y=mx+b IS slope, but slope from a table requires Δy÷Δx.', prompt: null },
  ],
  '8.F.A.3': [
    { label: 'Mistake A', wrong: 'Applying rise and run in the wrong order — running first and then rising.', fix: 'Always start at the y-intercept. Apply slope as rise first (up or down), then run (right).', prompt: 'A student was asked to graph y = 3x - 2. She plotted the y-intercept at (0, -2) correctly. To find her next point, she moved 1 unit up and 3 units right, reaching (3, -1). Identify the error and describe the correct process.' },
    { label: 'Mistake B', wrong: 'Starting the graph at the x-intercept instead of the y-intercept.', fix: 'The b in y = mx + b is the y-intercept. Begin at (0, b) on the y-axis, not where the line hits x.', prompt: null },
  ],
  '8.F.B.4': [
    { label: 'Mistake A', wrong: 'Using y1/x1 as slope — dividing a single y-value by its x-value is NOT the slope formula.', fix: 'Slope is a CHANGE ratio: m = (y2-y1)/(x2-x1). Always subtract coordinates.', prompt: 'A student found the function through (1, 7) and (4, 13) and wrote: m = 7/1 = 7; equation y = 7x + 13. Identify BOTH errors and write the correct equation.' },
    { label: 'Mistake B', wrong: 'Reading b as any y-value without checking whether x = 0 at that point.', fix: 'Only read b directly when x = 0 is confirmed; otherwise substitute a point and solve.', prompt: null },
  ],
  '8.F.B.5': [
    { label: 'Mistake A', wrong: 'Student says "the graph goes up" instead of "the graph is increasing".', fix: 'Use output language: the output value increases as the input increases — always describe what the output does.', prompt: null },
    { label: 'Mistake B', wrong: 'Student marks the y-intercept or an endpoint as the turning point.', fix: 'A turning point is an interior direction change — where the graph switches from increasing to decreasing (or vice versa).', prompt: null },
  ],
  '8.G.A.1': [
    { label: 'Mistake A', wrong: 'Treating negative dy as moving left.', fix: 'In (3, -2), dx = 3 moves right and dy = -2 moves DOWN. dx is horizontal; dy is vertical.', prompt: 'A student translated A(-2, 3) by the vector (4, -5) and recorded the image as A\'(2, 8). Identify the error and find the correct image.' },
    { label: 'Mistake B', wrong: 'Forgetting to apply the vector to every vertex.', fix: 'Translate each vertex individually using (dx, dy). All vertices shift the same way — image is congruent to the preimage.', prompt: 'A student translated B(5, -1) by the vector (-3, 2) and recorded the image as B\'(8, 1). Identify the error and find the correct image.' },
  ],
  '8.G.A.2': [
    { label: 'Mistake A', wrong: 'Negating the wrong coordinate — using (−x, y) for an x-axis reflection instead of (x, −y).', fix: 'x-axis: negate y only. y-axis: negate x only. The axis name tells you which coordinate stays.', prompt: 'A student reflects point A(4, -3) over the line y = x. The student uses the rule (x, y) → (−x, −y) and writes: A′(−4, 3). Find and correct the error.' },
    { label: 'Mistake B', wrong: 'Using the 180° rotation rule (−x, −y) for a y = x reflection instead of the swap (y, x).', fix: 'Reflection over y = x swaps coordinates only: (x, y) → (y, x). No negation.', prompt: 'A student reflects J(3, −5) over the line y = −x. The student uses the rule (x, y) → (−y, x) and writes: J′(5, 3). Find and correct the error.' },
    { label: 'Mistake C', wrong: 'Applying the second op to the original preimage instead of the intermediate image.', fix: 'Each step uses the previous result as its new preimage. Chain the operations in order.', prompt: 'A student composed two rigid motions on P(3, 4): Step 1: Translate by (1, 2) → P′ = (4, 6). ✓ Step 2: Reflect over x-axis → P″ = (4, 6). ✗ Describe the student’s error. State the correct final image P″.' },
    { label: 'Mistake D', wrong: 'Assuming the image is NOT congruent after two rigid motions.', fix: 'Compositions of rigid motions preserve distance and angle — the final image is ALWAYS congruent.', prompt: 'A student translated △ABC (A(1,2), B(3,2), C(2,4)) by (−1, 3), then reflected over y = x. Translate: A(0,5), B(2,5), C(1,7). ✓ Reflect over y = x: A″(0,5), B″(5,2), C″(7,1). ✗ Identify the error. State the correct A″B″C″.' },
  ],
  '8.G.A.3': [
    { label: 'Mistake A', wrong: 'Applying the CW rule (y, -x) when the problem says 90° CCW — confusing rotation direction.', fix: 'CCW is the CCSS default. The 90° CCW rule is (-y, x), not (y, -x).', prompt: 'Alex rotates P(3, 2) by 90° CCW about the origin and writes P′(2, −3). Identify the error and state the correct image coordinates. Error: ___________________________ Correct image: P′( ________ , ________ )' },
    { label: 'Mistake B', wrong: 'Mixing up 90° CCW and 270° CCW rules: getting (-y, x) and (y, -x) swapped.', fix: 'Remember: 90° CCW = (-y, x); 270° CCW = (y, -x). The signs flip between them.', prompt: null },
  ],
  '8.G.A.4': [
    { label: 'Mistake A', wrong: 'Multiplying only the x-coordinate: (3, 4) dilated k=2 gives (6, 4).', fix: 'The scale factor multiplies BOTH coordinates. The correct image is (6, 8).', prompt: 'A student was asked to dilate point P(4, 3) by scale factor 2 about the origin. The student wrote: "P\' = (4 + 2, 3 + 2) = (6, 5)." Describe the student\'s error. Then find the correct image P\'.' },
    { label: 'Mistake B', wrong: 'Confusing scale factor k with area factor: k=2 doubles lengths but quadruples area.', fix: 'Scale factor applies to distances, not areas. Each coordinate is multiplied by k, not k squared.', prompt: 'A student dilated triangle ABC with A(2, 4), B(6, 2), and C(4, 6) by scale factor 1/2 about the origin and recorded: A\'(1, 4), B\'(3, 2), C\'(2, 6). Find the student\'s error and state the correct image.' },
    { label: 'Mistake C', wrong: 'Thinking the image is CONGRUENT when a dilation is present.', fix: 'A dilation changes size. When k ≠ 1 appears in the sequence, the image is SIMILAR, not congruent.', prompt: 'A student found the image of △ABC: A(1, 2), B(3, 2), C(2, 4) after dilating by 2 about the origin then reflecting over the x-axis. Dilate ×2: A(2, 4), B(6, 4), C(4, 8). ✓ Reflect over x-axis: A″(1, −2), B″(3, −2), C″(2, −4). ✗ Describe the error. State the correct A″B″C″.' },
    { label: 'Mistake D', wrong: 'Applying the second op to the original preimage instead of the intermediate image.', fix: 'Each step acts on the result of the previous. Chain the operations in order.', prompt: 'A student dilated △JKL — J(2, 1), K(4, 1), L(3, 3) — by 2 about the origin, then translated by (1, 1). Step 1: J(4, 2), K(8, 2), L(6, 6). ✓ Step 2: J″(5, 3), K″(9, 3), L″(7, 7). ✓ The student wrote: “Since the image is twice as big, it is congruent to the original.” Identify the conceptual error. State whether J″K″L″ is similar or congruent to JKL.' },
  ],
  '8.G.A.5': [
    { label: 'Mistake A', wrong: 'Calling co-interior pairs congruent.', fix: 'Co-interior pairs are SUPPLEMENTARY — they sum to 180°, not share a measure.', prompt: 'A student solved: Lines ℓ₁ ∥ ℓ₂ cut by t. ∠4 = 97°. Find ∠5. Student wrote: \'∠4 and ∠5 are alternate interior angles. ∠5 = ∠4 = 97°.\' Describe the student\'s error. Find the correct ∠5.' },
    { label: 'Mistake B', wrong: 'Naming pairs without confirming the lines are parallel.', fix: 'The named relationships only hold when ℓ₁ ∥ ℓ₂. Always verify parallelism (tick marks or stated) first.', prompt: 'A student found ∠5 when ∠4 = 108°. Student wrote: \'∠4 and ∠5 are corresponding because they are at different intersections. ∠5 = ∠4 = 108°.\' Identify the error. Find the correct ∠5.' },
  ],
  '8.G.B.6': [
    { label: 'Mistake A', wrong: 'Using a²+b²=c² with any two sides — c must always be the LONGEST side.', fix: 'Sort the three sides first: a ≤ b ≤ c. Use only the two shorter sides as a and b.', prompt: null },
    { label: 'Mistake B', wrong: 'Confusing theorem and converse: the theorem proves right triangles; the converse tests for one.', fix: 'Converse: if a²+b²=c², then right. If not equal, compare > or < c² to classify.', prompt: null },
  ],
  '8.G.B.7': [
    { label: 'Mistake A', wrong: 'Adding legs before squaring: writing (6 + 8)² = c² instead of 6² + 8² = c².', fix: 'Square each leg first, then add. The formula is a² + b² = c², not (a + b)² = c².', prompt: null },
    { label: 'Mistake B', wrong: 'Assigning c to a leg instead of the hypotenuse. Only the side opposite the right angle is c.', fix: 'Find the right angle first (∠ = 90°). The side directly across from it is always the hypotenuse c.', prompt: null },
  ],
  '8.G.B.8': [
    { label: 'Mistake A', wrong: 'Adding legs before squaring: 6 + 8 = 14, not the distance.', fix: 'Square each leg: a² + b² = c². Then take √ for the distance.', prompt: 'A student found the distance between A(−1, 2) and B(3, 5). Here is their work: Horizontal change: 3 − (−1) = 4 Vertical change: 5 − 2 = 3 Distance = 4 + 3 = 7 Find and explain the error. Then find the correct distance.' },
    { label: 'Mistake B', wrong: 'Stopping at c² = 100 without taking √ — reporting 100 as the answer.', fix: 'Always take √ at the end: c = √100 = 10, not 100.', prompt: null },
  ],
  '8.G.C.9': [
    { label: 'Mistake A', wrong: 'Squaring the radius for a sphere: V = 4/3πr² instead of V = 4/3πr³.', fix: 'V = 4/3πr³ uses r CUBED — multiply r by itself three times, not twice.', prompt: 'A student found the volume of a sphere with radius 5 cm. Here is their work: V = 4/3 · π · 5² V = 4/3 · 25π V = 100π/3 cm³ Find and explain the error. Then find the correct volume in terms of π.' },
    { label: 'Mistake B', wrong: 'Forgetting ⅓ on a cone: writing V = πr²h instead of V = ⅓πr²h.', fix: 'The cone formula is exactly one-third of the same-base cylinder formula.', prompt: null },
  ],
  '8.NS.A.1': [
    { label: 'Mistake A', wrong: 'Thinking every square root is irrational, so √16 must be irrational.', fix: 'Check for a perfect square first: √16 = 4 and √0.25 = 0.5 are rational.', prompt: 'Cole and Diego classify √81. Cole says √81 must be IRRATIONAL because of the square root sign. Diego says √81 = 9, which is RATIONAL. Who is correct? Find and correct the error.' },
    { label: 'Mistake B', wrong: 'Calling any long or complicated-looking decimal irrational.', fix: 'A decimal that ends, or has a fixed repeating block, is rational no matter how long.', prompt: null },
  ],
  '8.NS.A.2': [
    { label: 'Mistake A', wrong: 'Assuming √N ≈ N/2 — e.g., √25 ≈ 12.5 instead of 5.', fix: 'A square root is not half the value. Find the two perfect squares bracketing N, then take their roots.', prompt: 'Two students estimate √17. Who is more accurate? Explain using perfect-square bounds. Ella: √17 ≈ 4.1 Max: √17 ≈ 4.2' },
    { label: 'Mistake B', wrong: 'Placing √5 at exactly 2.5 because 5 is halfway between 4 and 9.', fix: '5 is closer to 4 than to 9, so √5 ≈ 2.2, not 2.5. Proximity to the nearer square determines the estimate.', prompt: null },
  ],
  '8.SP.A.1': [
    { label: 'Mistake A', wrong: 'Calling a spread-out cloud "no association" when it still has a directional trend.', fix: 'Spread = weak association, not no association. Look for any consistent rise or fall first.', prompt: 'A student analyzed the scatter plot shown. Here is their work: The y-values (9, 8, 7, 6 ..) are all positive numbers greater than 0. Since the y-values are positive, this must be a positive association. Conclusion: positive linear association. Find the error. Then write the correct association description.' },
    { label: 'Mistake B', wrong: 'Saying a scatter plot "proves" one variable causes another.', fix: 'Scatter plots show association only. Causation requires controlled experiments, not just correlation.', prompt: null },
  ],
  '8.SP.A.2': [
    { label: 'Mistake A', wrong: 'Drawing the line through only the two extreme points (leftmost and rightmost).', fix: 'The line must balance ALL points — about half above and half below the entire cloud, not just the two endpoints.', prompt: 'A student analyzed the scatter plot shown. Here is their work: I drew my trend line by connecting the leftmost point (2, 2) and the rightmost point (9, 6). Since my line passes through two real data points, it must be the best fit. Any line through two actual data points is automatically the line of best fit. Find the error in the student\'s reasoning. Then describe how to correctly draw the line of best fit.' },
    { label: 'Mistake B', wrong: 'Thinking a line fits better when it passes through more data points exactly.', fix: 'Fit is judged by how tightly ALL points cluster around the line, not how many the line touches exactly.', prompt: null },
  ],
  '8.SP.A.3': [
    { label: 'Mistake A', wrong: 'Confusing slope and y-intercept — for example, saying the rate of change is 5 when the equation is y = 2x + 5 (slope is 2, not 5).', fix: 'In y = mx + b, m is always the coefficient of x (slope), and b is always the constant (y-intercept). Identify each by its position in the equation, not its value.', prompt: 'A student analyzed the scatter plot of study hours vs. quiz score. The trend line is y = x + 3. Here is the student\'s work: The slope is 3 — for each extra hour of studying, my quiz score goes up by 3 points. The y-intercept is 1 — when I study 0 hours, my predicted score is 1. Identify and correct all errors in the student\'s work.' },
    { label: 'Mistake B', wrong: 'Interpreting the y-intercept as meaningful when x = 0 is far outside the real data range.', fix: 'The y-intercept is a model prediction at x = 0. If x = 0 makes no real-world sense (for example, 0 years of experience), treat it as a mathematical value, not a useful prediction.', prompt: null },
  ],
  '8.SP.A.4': [
    { label: 'Mistake A', wrong: 'Using the grand total as denominator for a conditional frequency — this computes joint frequency instead of conditional.', fix: 'When a question restricts to one category ("given" or "of those"), use that row or column total as the denominator, not the grand total.', prompt: 'A student computes P(7th GIVEN Walk) from a 100-student survey. There are 40 walkers, and 25 of them are in 7th grade. The student writes: P(7th GIVEN Walk) = 25/100 = 0.25. Identify the error. Write the correct calculation.' },
    { label: 'Mistake B', wrong: 'Confusing P(A given B) with P(B given A) — reversing which category is the condition and which is the cell.', fix: 'The category named after "given" is always the denominator; the category named before "given" is the cell count numerator.', prompt: null },
  ],
};

/* Build a lookup: CCSS leaf code -> standard content object. */
const standardsMap = {};
Object.values(STANDARDS_CONTENT).forEach(s => { standardsMap[s.ccss] = s; });


/* ============================================================================
   SVG assets (inline — no external image deps; brand-tokened)
   ============================================================================ */
const SVG = {};

// Brand quadrant mark (small, for nav + footer)
SVG.mark = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <rect x="4" y="4" width="42" height="42" rx="7" fill="#1A3C34"/>
  <rect x="54" y="4" width="42" height="42" rx="7" fill="#D4A017"/>
  <rect x="4" y="54" width="42" height="42" rx="7" fill="#3FA9A2"/>
  <rect x="54" y="54" width="42" height="42" rx="7" fill="#D85D5D"/>
</svg>`;

// Hero signature: the four-in-one quadrant mark, labeled with the method
SVG.heroQuad = `<svg viewBox="0 0 460 460" role="img" aria-label="The 4-in-1 method: Reference, Practice, Apply, Assess arranged as four quadrants">
  <defs>
    <linearGradient id="gld" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e6be4f"/><stop offset="1" stop-color="#D4A017"/>
    </linearGradient>
  </defs>
  <!-- quadrants -->
  <g font-family="'Fraunces',serif">
    <rect x="20" y="20" width="195" height="195" rx="20" fill="#3FA9A2"/>
    <rect x="245" y="20" width="195" height="195" rx="20" fill="url(#gld)"/>
    <rect x="20" y="245" width="195" height="195" rx="20" fill="#D85D5D"/>
    <rect x="245" y="245" width="195" height="195" rx="20" fill="#2A4A7F"/>
    <!-- labels -->
    <text x="117" y="100" text-anchor="middle" fill="#fff" font-size="15" font-family="'IBM Plex Mono',monospace" letter-spacing="2">01</text>
    <text x="117" y="135" text-anchor="middle" fill="#fff" font-size="30" font-weight="600">Reference</text>
    <text x="342" y="100" text-anchor="middle" fill="#1A3C34" font-size="15" font-family="'IBM Plex Mono',monospace" letter-spacing="2">02</text>
    <text x="342" y="135" text-anchor="middle" fill="#1A3C34" font-size="30" font-weight="600">Practice</text>
    <text x="117" y="325" text-anchor="middle" fill="#fff" font-size="15" font-family="'IBM Plex Mono',monospace" letter-spacing="2">03</text>
    <text x="117" y="360" text-anchor="middle" fill="#fff" font-size="30" font-weight="600">Apply</text>
    <text x="342" y="325" text-anchor="middle" fill="#fff" font-size="15" font-family="'IBM Plex Mono',monospace" letter-spacing="2">04</text>
    <text x="342" y="360" text-anchor="middle" fill="#fff" font-size="30" font-weight="600">Assess</text>
  </g>
  <!-- center seal -->
  <circle cx="230" cy="230" r="48" fill="#1A3C34" stroke="#F7F5F0" stroke-width="6"/>
  <text x="230" y="222" text-anchor="middle" fill="#D4A017" font-size="30" font-weight="700" font-family="'Fraunces',serif">4</text>
  <text x="230" y="250" text-anchor="middle" fill="#F7F5F0" font-size="12" font-family="'IBM Plex Mono',monospace" letter-spacing="1">IN ONE</text>
</svg>`;

// Hero bg pattern (grid-paper + dots, subtle)
SVG.heroBg = `<svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="#F7F5F0" stroke-opacity="0.08" stroke-width="1"/>
    </pattern>
    <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="0" cy="0" r="1.4" fill="#D4A017" fill-opacity="0.16"/>
    </pattern>
  </defs>
  <rect width="800" height="600" fill="url(#grid)"/>
  <rect width="800" height="600" fill="url(#dots)"/>
</svg>`;

// small card quad (fallback art)
SVG.cardQuad = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect x="6" y="6" width="40" height="40" rx="6" fill="#3FA9A2"/>
  <rect x="54" y="6" width="40" height="40" rx="6" fill="#D4A017"/>
  <rect x="6" y="54" width="40" height="40" rx="6" fill="#D85D5D"/>
  <rect x="54" y="54" width="40" height="40" rx="6" fill="#2A4A7F"/>
</svg>`;

// method phase icons
SVG.phaseIcons = {
  reference: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  practice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  apply: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/></svg>`,
  assess: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`
};

const ICON = {
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  ext: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z"/></svg>`,
  store: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 7l1.5-4h17L22 7"/><path d="M4 7v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7"/><path d="M2 7a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></svg>`
};

/* ============================================================================
   shared partials
   ============================================================================ */
function head(opts) {
  const title = opts.title;
  const desc = opts.desc;
  const canonical = SITE_URL + '/' + (opts.path === 'index.html' ? '' : opts.path);
  const ogImage = opts.ogImage || (SITE_URL + '/assets/images/og_image.png');
  const ogType = opts.ogType || 'website';
  const jsonld = opts.jsonld ? `\n<script type="application/ld+json">${opts.jsonld}</script>` : '';
  const orgSchema = `\n<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Math Class 678',
    url: SITE_URL,
    logo: SITE_URL + '/assets/images/favicon.svg',
    email: CONTACT.support,
    sameAs: [SOCIAL.pinterest, SOCIAL.instagram, SOCIAL.tiktok, TPT_STORE]
  })}</script>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Math Class 678">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ogImage}">
<meta name="theme-color" content="#1A3C34">
<link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/styles.css">${orgSchema}${jsonld}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>`;
}

function nav(active) {
  const link = (href, label, key) =>
    `<a class="nav__link${active === key ? ' is-active' : ''}" href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="nav">
  <div class="wrap nav__inner">
    <a class="brand" href="/" aria-label="Math Class 678 home">
      <span class="brand__mark">${SVG.mark}</span>
      <span class="brand__text">
        <span class="brand__name">math class 678</span>
        <span class="brand__sub">4-in-1 skill sheets</span>
      </span>
    </a>
    <button class="nav__toggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="navlinks"><span></span></button>
    <nav class="nav__links" id="navlinks" aria-label="Primary">
      ${link('/catalog.html', 'Catalog', 'catalog')}
      ${link('/bundles.html', 'Bundles', 'bundles')}
      ${link('/free.html', 'Free Resources', 'free')}
      ${link('/about.html', 'About', 'about')}
      ${link('/contact.html', 'Contact', 'contact')}
      <a class="btn btn--primary btn--sm nav__cta" href="${TPT_STORE}" target="_blank" rel="noopener">TPT Store ${ICON.ext}</a>
    </nav>
  </div>
</header>`;
}

function kitSignup() {
  return `<section class="kit-signup">
    <div class="wrap">
      <div class="kit-signup__inner reveal">
        <div class="kit-signup__copy">
          <span class="eyebrow">Free resource</span>
          <h2>Get a free 4-in-1 Skill Sheet</h2>
          <p>Sign up and I'll send you Combining Like Terms for 6th grade — a complete 4-in-1 Skill Sheet, no strings attached. You'll also hear when new sheets publish and when the store runs a sale.</p>
        </div>
        <div class="kit-signup__form">
          ${KIT_SCRIPT}
        </div>
      </div>
    </div>
  </section>`;
}

/* High-prominence lead-magnet block. Used as the single loudest conversion
   element on the homepage and on every sheet page. Full-bleed forest panel,
   freebie thumbnail, benefit bullets, and the Kit form (uid bd0030d799). */
function kitHero(opts) {
  opts = opts || {};
  const eyebrow = opts.eyebrow || 'Free 4-in-1 Skill Sheet';
  const heading = opts.heading || 'Get a complete skill sheet free';
  const lead = opts.lead || 'Enter your email and I\u2019ll send you the Combining Like Terms 4-in-1 Skill Sheet for 6th grade \u2014 reference, practice, application, and an exit ticket with answer key. The same format I have used in my own classroom for twenty-five years.';
  return `<section class="kit-hero" id="free-sheet">
    <div class="wrap kit-hero__grid">
      <div class="kit-hero__copy reveal">
        <span class="eyebrow">${eyebrow}</span>
        <h2>${heading}</h2>
        <p class="kit-hero__lead">${lead}</p>
        <ul class="kit-hero__list">
          <li>A complete lesson on one printable, not a watered-down sample</li>
          <li>Reference, practice, real-world application, and an exit ticket with answer key</li>
          <li>Editable teacher slides included</li>
        </ul>
        <p class="kit-hero__reassure">No spam. Unsubscribe in one click anytime.</p>
      </div>
      <div class="kit-hero__panel reveal">
        <figure class="kit-hero__thumb">
          <img src="/assets/images/freebies/free_clt-poster.jpg" alt="Free Combining Like Terms 4-in-1 Skill Sheet and anchor chart poster for 6th grade math" width="900" height="900" loading="lazy" decoding="async">
        </figure>
        <div class="kit-hero__formcard">
          <span class="kit-hero__formlabel">Send it to my inbox</span>
          <div class="kit-hero__form">
            ${KIT_SCRIPT}
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function footer(opts) {
  opts = opts || {};
  const kitBand = opts.noKit ? '' : kitSignup();
  return `${kitBand}
<footer class="footer">
  <div class="wrap">
    <div class="footer__grid">
      <div class="footer__brand">
        <a class="brand" href="/" aria-label="Math Class 678 home">
          <span class="brand__mark" style="width:30px;height:30px">${SVG.mark}</span>
          <span class="brand__text"><span class="brand__name">math class 678</span></span>
        </a>
        <p>4-in-1 Skill Sheets for grades 6, 7, and 8 Common Core math. One skill, one complete lesson: Reference, Practice, Apply, Assess.</p>
      </div>
      <div>
        <h4>Browse</h4>
        <ul class="footer__links">
          <li><a href="/catalog.html">All Skill Sheets</a></li>
          <li><a href="/bundles.html">Bundles</a></li>
          <li><a href="/grade-6.html">6th Grade</a></li>
          <li><a href="/grade-7.html">7th Grade</a></li>
          <li><a href="/grade-8.html">8th Grade</a></li>
          <li><a href="/free.html">Free Resources</a></li>
        </ul>
      </div>
      <div>
        <h4>Studio</h4>
        <ul class="footer__links">
          <li><a href="/about.html">About</a></li>
          <li><a href="/contact.html">Contact</a></li>
          <li><a href="${TPT_STORE}" target="_blank" rel="noopener">TPT Store</a></li>
          <li><a href="/get-started.html">Get a free sheet</a></li>
        </ul>
      </div>
      <div>
        <h4>Follow</h4>
        <ul class="footer__links">
          <li><a href="${SOCIAL.pinterest}" target="_blank" rel="noopener">Pinterest</a></li>
          <li><a href="${SOCIAL.instagram}" target="_blank" rel="noopener">Instagram</a></li>
          <li><a href="${SOCIAL.tiktok}" target="_blank" rel="noopener">TikTok</a></li>
          <li><a href="mailto:${CONTACT.support}">${CONTACT.support}</a></li>
        </ul>
      </div>
    </div>
    <div class="footer__bottom">
      <span>&copy; ${new Date().getFullYear()} Math Class 678. All rights reserved.</span>
      <span>Every sheet sold on <a href="${TPT_STORE}" target="_blank" rel="noopener">Teachers Pay Teachers</a>.</span>
    </div>
  </div>
</footer>`;
}

function scripts() { return `<script src="/assets/js/catalog.js" defer></script>\n</body>\n</html>`; }

/* ============================================================================
   product card
   ============================================================================ */
function productCard(p) {
  const cls = `pcard pcard--${p.grade}${p.free ? ' pcard--free' : ''}`;
  const search = (p.name + ' ' + p.ccss + ' ' + p.strandName + ' ' + p.gradeLabel).toLowerCase();
  const ctaLabel = 'View sheet';
  // Fallback CSS/SVG "thumbnail" if no image asset exists
  const art = `<div class="pcard__art" aria-hidden="true">
        <div class="pcard__art-top">
          <span class="pcard__art-eyebrow">4-in-1 Skill Sheet</span>
          <span class="pcard__art-wm">${p.grade}th grade</span>
        </div>
        <div class="pcard__art-body">
          <span class="pcard__art-quad">${SVG.cardQuad}</span>
          <span class="pcard__art-skill">${esc(p.name)}</span>
          <span class="pcard__art-sub">Reference · Practice · Apply · Assess</span>
        </div>
        <div class="pcard__art-bottom"></div>
      </div>`;
  return `<article class="${cls}" data-grade="${p.grade}" data-strand="${p.strand}" data-search="${esc(search)}">
    <div class="pcard__media">
      ${p.free ? '<span class="pcard__badge">Free</span>' : ''}
      ${art}
      ${p.hasThumb ? `<img src="${p.thumbWeb}" alt="${esc(sheetAlt(p))}" width="600" height="600" loading="lazy" decoding="async" onerror="this.style.display='none'">` : ''}
    </div>
    <div class="pcard__body">
      <span class="pcard__ccss"><span class="pcard__grade-dot"></span>${esc(p.ccss)}</span>
      <h3>${esc(p.name)}</h3>
      ${p.desc ? `<p class="pcard__desc">${esc(p.desc)}</p>` : '<p class="pcard__desc"></p>'}
      <div class="pcard__foot">
        <span class="pcard__bundle">${esc(p.gradeLabel)}</span>
        <a class="pcard__tpt pcard__cta" href="${p.pageUrl}" aria-label="${esc(ctaLabel)}: ${esc(p.name)}, grade ${p.grade}, standard ${esc(p.ccss)}">${ctaLabel} ${ICON.arrow}</a>
      </div>
    </div>
  </article>`;
}

/* ============================================================================
   FAQ — homepage block + FAQPage schema. Teacher-voice questions.
   ============================================================================ */
const FAQ = [
  {
    q: 'What is a 4-in-1 Skill Sheet?',
    a: 'Each sheet covers one Common Core standard and moves a student through four phases on a single printable: a color Reference page they keep, scaffolded Practice from guided notes to sixteen sequenced problems, real-world Apply problems, and an Assess exit ticket with a full answer key. A ten-slide editable teacher deck with speaker notes is included.'
  },
  {
    q: 'Can I print just one standard at a time?',
    a: 'Yes. That is the whole point of one skill per sheet. When you are teaching 7.RP.A.2 this week, you print that sheet — not a forty-page packet. It keeps the structure of the standard visible and makes intervention, reteach, and spiral review easy to target.'
  },
  {
    q: 'Will these work for a sub day or emergency plan?',
    a: 'They are built for it. Because each sheet is self-contained — reference, practice, application, and an exit ticket with an answer key — a substitute can hand it out and a student can work through it without you in the room. There is also a free 3-day emergency sub plan on the free resources page.'
  },
  {
    q: 'How are the sheets aligned to Common Core?',
    a: 'Every sheet maps to exactly one CCSS standard, labeled with its clean code (for example 8.EE.B.5). The catalog is sequenced by standard so you can match what you are teaching to the sheet that covers it. Standards fluency is built into the design, not bolted on.'
  },
  {
    q: 'Where do I actually buy the sheets?',
    a: 'Every sheet lives on Teachers Pay Teachers. This site is a catalog and showcase — it sells nothing directly. Each sheet has its own page here with the standard and the skill, and the button routes you straight to the matching TPT listing to purchase and download.'
  },
  {
    q: 'Is there anything free to try first?',
    a: 'Yes. There are two free 4-in-1 Skill Sheets (Combining Like Terms for 6th and 7th grade), plus free anchor chart posters, curriculum maps, back-to-school tools, and end-of-year reviews. Start on the free resources page before spending a dollar.'
  }
];


/* ============================================================================
   free resource data — non-skill-sheet free products
   key, title, sub: display copy
   grade: 6|7|8|'all'   gradeLabel: display string
   cat: section grouping   thumb: filename in assets/images/freebies/
   url: live TPT product URL (all confirmed live)
   ============================================================================ */
const FREE_RESOURCES = [
  // Back to School
  { key:'bts-diagnostic',       title:'Back to School Math Diagnostic',   sub:'Day 1 Readiness Check',                grade:'all', gradeLabel:'Grades 6\u20138', cat:'Back to School',        thumb:'free_bts-diagnostic.jpg',            url:'https://www.teacherspayteachers.com/Product/FREE-Back-to-School-Math-Diagnostic-Day-1-Readiness-Check-Grades-6-8-16643656' },
  { key:'smart-goals-6th',      title:'SMART Goals Worksheet',            sub:'Back to School Goal Setting',          grade:6,     gradeLabel:'6th Grade',       cat:'Back to School',        thumb:'free_smart-goals-6th.jpg',           url:'https://www.teacherspayteachers.com/Product/6th-Grade-Math-SMART-Goals-FREE-Back-to-School-Goal-Setting-Worksheet-16506706' },
  { key:'smart-goals-7th',      title:'SMART Goals Worksheet',            sub:'Back to School Goal Setting',          grade:7,     gradeLabel:'7th Grade',       cat:'Back to School',        thumb:'free_smart-goals-7th.jpg',           url:'https://www.teacherspayteachers.com/Product/7th-Grade-Math-SMART-Goals-FREE-Back-to-School-Goal-Setting-Worksheet-16506713' },
  { key:'smart-goals-8th',      title:'SMART Goals Worksheet',            sub:'Back to School Goal Setting',          grade:8,     gradeLabel:'8th Grade',       cat:'Back to School',        thumb:'free_smart-goals-8th.jpg',           url:'https://www.teacherspayteachers.com/Product/8th-Grade-Math-SMART-Goals-FREE-Back-to-School-Goal-Setting-Worksheet-16506718' },
  { key:'about-me-6th',         title:'Math About Me Activity',           sub:'Back to School First Day',             grade:6,     gradeLabel:'6th Grade',       cat:'Back to School',        thumb:'free_about-me-6th.jpg',              url:'https://www.teacherspayteachers.com/Product/6th-Grade-Math-About-Me-Back-to-School-First-Day-Activity-FREE-16495648' },
  { key:'about-me-7th',         title:'Math About Me Activity',           sub:'Back to School First Day',             grade:7,     gradeLabel:'7th Grade',       cat:'Back to School',        thumb:'free_about-me-7th.jpg',              url:'https://www.teacherspayteachers.com/Product/7th-Grade-Math-About-Me-Back-to-School-First-Day-Activity-FREE-16495649' },
  // Classroom & Planning
  { key:'year-at-a-glance-6th', title:'Year at a Glance',                 sub:'I Can Checklist + CCSS Curriculum Map',grade:6,     gradeLabel:'6th Grade',       cat:'Classroom & Planning',  thumb:'free_year-at-a-glance-6th.jpg',      url:'https://www.teacherspayteachers.com/Product/6th-Grade-Math-Year-at-a-Glance-FREE-I-Can-Checklist-CCSS-Curriculum-Map-16495554' },
  { key:'year-at-a-glance-7th', title:'Year at a Glance',                 sub:'I Can Checklist + CCSS Curriculum Map',grade:7,     gradeLabel:'7th Grade',       cat:'Classroom & Planning',  thumb:'free_year-at-a-glance-7th.jpg',      url:'https://www.teacherspayteachers.com/Product/7th-Grade-Math-Year-at-a-Glance-FREE-I-Can-Checklist-CCSS-Curriculum-Map-16495555' },
  { key:'clt-poster',           title:'Combining Like Terms Poster',       sub:'Anchor Chart \u00b7 6.EE.A.3',        grade:6,     gradeLabel:'6th Grade',       cat:'Classroom & Planning',  thumb:'free_clt-poster.jpg',                url:'https://www.teacherspayteachers.com/Product/FREE-Combining-Like-Terms-Poster-6th-Grade-Math-Anchor-Chart-6EEA3-16654146' },
  { key:'pyth-poster',          title:'Pythagorean Theorem Poster',        sub:'Anchor Chart \u00b7 8.G.B.7',         grade:8,     gradeLabel:'8th Grade',       cat:'Classroom & Planning',  thumb:'free_pythagorean-theorem-poster.jpg', url:'https://www.teacherspayteachers.com/Product/FREE-Pythagorean-Theorem-Poster-8th-Grade-Math-Anchor-Chart-8GB7-16654289' },
  { key:'word-wall',            title:'Middle School Math Word Wall',      sub:'80 Vocabulary Cards',                  grade:'all', gradeLabel:'Grades 6\u20138', cat:'Classroom & Planning',  thumb:'free_word-wall.jpg',                 url:'https://www.teacherspayteachers.com/Product/Middle-School-Math-Word-Wall-80-Vocabulary-Cards-6th-7th-8th-Grade-Math-FREE-16283183' },
  // End of Year
  { key:'eoy-review-6th',       title:'End of Year Review',               sub:'Skills Check Worksheet',               grade:6,     gradeLabel:'6th Grade',       cat:'End of Year',           thumb:'free_eoy-review-6th.jpg',            url:'https://www.teacherspayteachers.com/Product/6th-Grade-Math-End-of-Year-Review-FREE-Skills-Check-Worksheet-Spring-2026-16213887' },
  { key:'eoy-review-7th',       title:'End of Year Review',               sub:'Skills Check Worksheet',               grade:7,     gradeLabel:'7th Grade',       cat:'End of Year',           thumb:'free_eoy-review-7th.jpg',            url:'https://www.teacherspayteachers.com/Product/7th-Grade-Math-End-of-Year-Review-FREE-Skills-Check-Worksheet-Spring-2026-16214437' },
  { key:'eoy-review-8th',       title:'End of Year Review',               sub:'Skills Check \u00b7 Pre-Algebra',      grade:8,     gradeLabel:'8th Grade',       cat:'End of Year',           thumb:'free_eoy-review-8th.jpg',            url:'https://www.teacherspayteachers.com/Product/8th-Grade-Math-Pre-Algebra-End-of-Year-Review-FREE-Skills-Check-Spring-2026-16214461' },
  { key:'eoy-reflection',       title:'End of Year Reflection + Goals',   sub:'Middle School',                        grade:'all', gradeLabel:'Grades 6\u20138', cat:'End of Year',           thumb:'free_eoy-reflection.jpg',            url:'https://www.teacherspayteachers.com/Product/End-of-Year-Math-Reflection-Goals-Middle-School-6th-7th-8th-FREE-16214595' },
  { key:'sub-plan',             title:'3-Day Emergency Math Sub Plan',    sub:'Middle School',                        grade:'all', gradeLabel:'Grades 6\u20138', cat:'End of Year',           thumb:'free_sub-plan.jpg',                  url:'https://www.teacherspayteachers.com/Product/3-Day-Emergency-Math-Sub-Plan-Middle-School-6th-7th-8th-Grade-FREE-16214563' },
];

/* --- free resource card (non-skill-sheet freebies) --- */
function freeResourceCard(r) {
  const gc = r.grade === 'all' ? 'all' : r.grade;
  return `<article class="rcard rcard--${gc}">
  <div class="rcard__media">
    <span class="pcard__badge">Free</span>
    <img src="/assets/images/freebies/${r.thumb}" alt="${esc(r.title)} \u2014 ${esc(r.sub)}" width="600" height="600" loading="lazy" decoding="async">
  </div>
  <div class="rcard__body">
    <div class="rcard__meta">
      <span class="rcard__grade rcard__grade--${gc}">${esc(r.gradeLabel)}</span>
      <span class="rcard__cat">${esc(r.cat)}</span>
    </div>
    <h3 class="rcard__title">${esc(r.title)}</h3>
    <p class="rcard__sub">${esc(r.sub)}</p>
    <div class="rcard__foot">
      <a class="rcard__cta" href="${r.url}" target="_blank" rel="noopener">Download free on TPT ${ICON.arrow}</a>
    </div>
  </div>
</article>`;
}

/* ============================================================================
   PAGE: home
   ============================================================================ */
function pageHome() {
  const featured = [
    products.find(p => p.num === '4'),   // Understanding Ratios (6)
    products.find(p => p.num === '77'),  // Slope-Intercept (8)
    products.find(p => p.num === '41'),  // Percent Problems (7)
    products.find(p => p.num === '96'),  // Pythagorean Theorem (8)
    products.find(p => p.num === '16'),  // Exponents (6)
    products.find(p => p.num === '50')   // Experimental & Theoretical Probability (7)
  ].filter(Boolean);

  const phase = (key, n, title, body) => `<article class="phase-card reveal">
      <span class="phase-card__n">${n}</span>
      <span class="phase-card__ico">${SVG.phaseIcons[key]}</span>
      <h3>${title}</h3>
      <p>${body}</p>
    </article>`;

  const band = (g, name, blurb) => {
    const c = counts[g];
    const photoAlt = { 6: '6th grade math worksheet with ratio table and teal accent', 7: '7th grade coordinate plane worksheet with protractor and coral accent', 8: '8th grade graphing linear equations worksheet with navy accent' };
    return `<a class="band band--${g} reveal" href="/grade-${g}.html">
      <img src="/assets/images/grade_${g}_photo.jpg" alt="${photoAlt[g]}" class="band__photo" width="900" height="900" loading="lazy" decoding="async">
      <span class="band__grade">${name}</span>
      <h3>Grade ${g} Math</h3>
      <p>${blurb}</p>
      <span class="band__foot">
        <span class="band__count"><b>${c}</b> skill sheets</span>
        <span class="band__go">Browse ${ICON.arrow}</span>
      </span>
    </a>`;
  };

  // Review schema. Individual Review objects emit whenever genuine attributed
  // reviews exist in REVIEWS (they are displayed on-page in the proof band, so
  // this is policy-compliant). AggregateRating is added only when real
  // store-wide TPT figures are supplied via TPT_RATING (never fabricated).
  const orgReviewSchema = (REVIEWS.length || TPT_RATING) ? [Object.assign({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Math Class 678',
    url: SITE_URL
  },
    TPT_RATING ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: TPT_RATING.ratingValue,
        reviewCount: TPT_RATING.reviewCount,
        bestRating: 5,
        worstRating: 1
      }
    } : {},
    REVIEWS.length ? {
      review: REVIEWS.map(r => ({
        '@type': 'Review',
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
        author: { '@type': 'Person', name: r.author },
        reviewBody: r.body,
        ...(r.datePublished ? { datePublished: r.datePublished } : {})
      }))
    } : {}
  )] : [];
  const ratingSchema = orgReviewSchema;

  return head({
    title: 'Math Class 678 — 4-in-1 Skill Sheets for Grades 6, 7, 8 Common Core Math',
    desc: 'A complete catalog of 4-in-1 Skill Sheets for middle school math. One skill per sheet, four learning phases: Reference, Practice, Apply, Assess. Built by a 25-year teacher.',
    path: 'index.html',
    jsonld: JSON.stringify([{
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Math Class 678',
      url: SITE_URL,
      description: 'A complete catalog of 4-in-1 Skill Sheets for middle school math, grades 6–8, CCSS-aligned. Built by a 25-year middle school math teacher.',
      publisher: { '@type': 'Organization', name: 'Math Class 678', url: SITE_URL }
    }, {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a }
      }))
    }, ...ratingSchema]).replace(/</g, '\\u003c')
  }) + nav('home') + `
<main id="main">
  <!-- HERO -->
  <section class="hero">
    <div class="hero__bg">${SVG.heroBg}</div>
    <div class="wrap hero__inner">
      <div class="hero__copy">
        <span class="eyebrow hero__eyebrow">${counts.all} sheets · grades 6–8 · CCSS</span>
        <h1><span class="phase gold">Reference.</span> Practice.<br>Apply. <span class="phase">Assess.</span></h1>
        <p class="hero__lead">Standards-aligned 4-in-1 Skill Sheets for grades 6, 7, and 8 math — built by a teacher with 25 years in the classroom. Every skill on one printable sheet: a reference page, guided practice, real-world application, and a built-in exit ticket, plus editable teacher slides.</p>
        <div class="hero__cta">
          <a class="btn btn--primary" href="/catalog.html">Browse all sheets ${ICON.arrow}</a>
          <a class="btn btn--on-dark" href="/free.html">Free resources</a>
        </div>
        <div class="hero__meta">
          <span class="hero__stat"><b>${counts.all}</b><span>Skill sheets</span></span>
          <span class="hero__stat"><b>6–8</b><span>Grade bands</span></span>
          <span class="hero__stat"><b>4</b><span>Phases per sheet</span></span>
          <span class="hero__stat"><b>25 yr</b><span>Classroom-built</span></span>
        </div>
      </div>
      <div class="quadmark">${SVG.heroQuad}</div>
    </div>
  </section>

  ${kitHero({ heading: 'Start with a free skill sheet', lead: 'Enter your email and I\u2019ll send you the Combining Like Terms 4-in-1 Skill Sheet for 6th grade \u2014 a complete lesson on one printable. See exactly how the format works before you spend a dollar.' })}

  <!-- METHOD BANNER -->
  <section class="method-banner">
    <img src="/assets/images/method_banner.png" alt="The 4-in-1 Method: Reference, Practice, Apply, Assess — four learning phases on one skill sheet" class="method-banner__img" width="1600" height="534" fetchpriority="high" decoding="async">
  </section>

  <!-- PRODUCT SPREAD -->
  <section class="spread section">
    <div class="wrap spread__grid">
      <div class="spread__copy reveal">
        <span class="eyebrow">What's inside</span>
        <h2>A complete lesson in one printable</h2>
        <p>Every 4-in-1 Skill Sheet carries a full lesson on one standard — twelve pages of structured content and ten editable teacher slides, sequenced from first instruction to formative check. Everything you need for the skill, nothing from the next one.</p>
        <ul class="spread__list">
          <li>Color reference page students keep all year — definitions, key rules, worked examples, visual model</li>
          <li>Cloze guided notes for direct instruction, plus 16 sequenced practice problems</li>
          <li>Real-world word problems and a half-sheet notebook insert</li>
          <li>Exit ticket strips with Work: and Answer: labels, plus a full teacher answer key</li>
          <li>10-slide editable teacher deck with speaker notes for every slide</li>
        </ul>
      </div>
      <div class="reveal">
        <img src="/assets/images/product_spread.jpg" alt="Four pages of a 4-in-1 Skill Sheet spread out: reference page, guided practice, real-world application, and exit ticket" class="spread__img" width="1440" height="960" loading="lazy" decoding="async">
      </div>
    </div>
  </section>

  <!-- WHY ONE SHEET PER SKILL -->
  <section class="section why">
    <div class="wrap">
      <div class="sec-head reveal">
        <div class="sec-head__t">
          <span class="eyebrow">Why one sheet per skill</span>
          <h2>Built for how the day actually goes</h2>
          <p>Most worksheet packets bury one skill inside forty pages. After twenty-five years in the classroom, I built these the other way around: one standard, one complete sheet, so the right resource is always the one already in your hand.</p>
        </div>
      </div>
      <div class="why__grid">
        <article class="why__card why__card--6 reveal">
          <h3>Bell-ringers and warm-ups</h3>
          <p>Pull the reference page or a handful of practice problems for a five-minute opener that lands exactly on the standard you are teaching this week — no hunting, no editing out off-topic problems.</p>
        </article>
        <article class="why__card why__card--7 reveal">
          <h3>Intervention and small groups</h3>
          <p>When a student needs one specific skill retaught, hand them that one sheet. The scaffolded progression from guided notes to independent practice does the heavy lifting while you work the table.</p>
        </article>
        <article class="why__card why__card--8 reveal">
          <h3>Sub days and emergencies</h3>
          <p>Each sheet is self-contained — reference, practice, application, and an exit ticket with an answer key. A substitute can run it without you, and you come back to formative data instead of a lost day.</p>
        </article>
        <article class="why__card why__card--6 reveal">
          <h3>Spiral review and test prep</h3>
          <p>Because every sheet maps to a single standard, building a spiral review or a targeted prep set is a matter of pulling the standards you need — not rewriting a packet to fit.</p>
        </article>
        <article class="why__card why__card--7 reveal">
          <h3>First instruction</h3>
          <p>The cloze guided notes and the ten-slide editable deck carry a full lesson, so a sheet can anchor your direct instruction, not just the practice that follows it.</p>
        </article>
        <article class="why__card why__card--8 reveal">
          <h3>Formative checks</h3>
          <p>The built-in exit ticket tells you who is ready to move on and who needs another pass — before you have planned tomorrow, while there is still time to adjust.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- SOCIAL PROOF -->
  <section class="section proof">
    <div class="wrap">
      <div class="sec-head reveal">
        <div class="sec-head__t">
          <span class="eyebrow">From teachers</span>
          <h2>What teachers are saying</h2>
          ${TPT_RATING ? `<p class="proof__rating"><span class="proof__stars" aria-hidden="true">★★★★★</span> <strong>${TPT_RATING.ratingValue}</strong> average across <strong>${TPT_RATING.reviewCount.toLocaleString()}</strong> ratings on Teachers Pay Teachers</p>` : ''}
        </div>
      </div>
      <div class="proof__grid">
        <article class="proof__card proof__card--6 reveal">
          <div class="proof__stars" aria-label="5 out of 5 stars">★★★★★</div>
          <p class="proof__title">Saved me so much prep time</p>
          <blockquote class="proof__quote">
            <p>I used this 6th grade unit rate skill sheet in my classroom, and it made the lesson flow so smoothly. The reference, practice, and exit ticket were all in one place, and my students had plenty of practice without feeling overwhelmed.</p>
          </blockquote>
          <footer class="proof__foot">
            <span class="proof__name">Lauren K.</span>
            <span class="proof__context">Texas · teaches 6th, 7th</span>
          </footer>
        </article>
        <article class="proof__card proof__card--7 reveal">
          <div class="proof__stars" aria-label="5 out of 5 stars">★★★★★</div>
          <p class="proof__title">Exactly what I needed</p>
          <blockquote class="proof__quote">
            <p>Exactly what I needed for two-step equations. My students usually get lost when we move from guided notes to independent practice, but this sheet made the progression feel natural, and the answer key showed the steps instead of just giving the final answer.</p>
          </blockquote>
          <footer class="proof__foot">
            <span class="proof__name">Megan T.</span>
            <span class="proof__context">Ohio · teaches 7th, 8th</span>
          </footer>
        </article>
        <article class="proof__card proof__card--8 reveal">
          <div class="proof__stars" aria-label="5 out of 5 stars">★★★★★</div>
          <p class="proof__title">More than just a worksheet</p>
          <blockquote class="proof__quote">
            <p>The examples were clear enough for absent students to use later. I also used the editable slides the next day for a quick reteach, which made the resource feel more like a mini lesson than just a worksheet.</p>
          </blockquote>
          <footer class="proof__foot">
            <span class="proof__name">Rachel B.</span>
            <span class="proof__context">Georgia · teaches 8th, Algebra 1</span>
          </footer>
        </article>
      </div>
    </div>
  </section>

  <!-- FOUNDER BAND -->
  <section class="section founder">
    <div class="wrap founder__grid">
      <figure class="founder__photo reveal">
        <img src="/assets/images/founder_portrait.jpg" alt="Greg, the founder of Math Class 678, in his middle school math classroom in front of anchor charts for exponent rules and the distributive property" width="1100" height="1375" loading="lazy" decoding="async">
      </figure>
      <div class="founder__copy reveal">
        <span class="eyebrow">Meet the teacher</span>
        <h2>Every sheet is written by one teacher who has taught these standards for 25 years</h2>
        <p>I am Greg. I have spent more than twenty-five years teaching grades 6 to 8 math, and I built Math Class 678 out of the thing I always needed: one standard, one complete sheet, the whole lesson in your hand. The common-misconception callouts on every sheet are not generic — they are the exact errors I have watched students make, year after year.</p>
        <div class="founder__cta">
          <a class="btn btn--ghost" href="/about.html">Read the full story ${ICON.arrow}</a>
        </div>
      </div>
    </div>
  </section>

  <!-- GRADE BANDS -->
  <section class="section gridpaper">
    <div class="wrap">
      <div class="sec-head reveal">
        <div class="sec-head__t">
          <span class="eyebrow">By grade</span>
          <h2>Find your grade band</h2>
          <p>Aligned to Common Core, sequenced by standard, color-coded by grade so you can find the exact skill you are teaching this week.</p>
        </div>
        <a class="btn btn--ghost" href="/catalog.html">See full catalog ${ICON.arrow}</a>
      </div>
      <div class="bands__grid">
        ${band('6', '6th grade', 'Ratios, the number system, expressions and equations, statistics, and geometry — the full sixth-grade arc.')}
        ${band('7', '7th grade', 'Proportional relationships, rational-number operations, probability, sampling, and geometry across the seventh-grade standards.')}
        ${band('8', '8th grade', 'Linear functions, systems, exponents and scientific notation, transformations, and the Pythagorean Theorem.')}
      </div>
    </div>
  </section>

  <!-- BUNDLES BAND -->
  <section class="section bundles-band">
    <div class="wrap">
      <div class="sec-head reveal">
        <div class="sec-head__t">
          <span class="eyebrow">Buy in bulk</span>
          <h2>Bundles for every strand and the full year</h2>
          <p>Grab a whole strand, a single topic, or an entire grade at once. ${bundles.length} bundles across grades 6 to 8, including the complete 103-sheet ULTIMATE bundle.</p>
        </div>
        <a class="btn btn--ghost reveal" href="/bundles.html">See all bundles ${ICON.arrow}</a>
      </div>
      <div class="card-grid">
        ${bundles.filter(b => ['6th-grade-math-mega-bundle','7th-grade-math-mega-bundle','8th-grade-math-mega-bundle','middle-school-math-ultimate-bundle'].includes(b.slug)).map(bundleCard).join('\n')}
      </div>
    </div>
  </section>

  <!-- FEATURED -->
  <section class="section">
    <div class="wrap">
      <div class="sec-head reveal">
        <div class="sec-head__t">
          <span class="eyebrow">A look inside</span>
          <h2>Featured skill sheets</h2>
          <p>A sample from across the catalog. Each card opens its own page with the standard, the skill, and a direct link to Teachers Pay Teachers.</p>
        </div>
      </div>
      <div class="card-grid">
        ${featured.map(productCard).join('\n')}
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section class="section faq">
    <div class="wrap">
      <div class="sec-head reveal">
        <div class="sec-head__t">
          <span class="eyebrow">Questions</span>
          <h2>Common questions</h2>
          <p>What teachers ask before they buy. If your question is not here, the contact page is one click away.</p>
        </div>
      </div>
      <div class="faq__list">
        ${FAQ.map(item => `<details class="faq__item reveal">
          <summary class="faq__q">${esc(item.q)}</summary>
          <div class="faq__a"><p>${esc(item.a)}</p></div>
        </details>`).join('\n        ')}
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="ctaband">
    <div class="wrap ctaband__inner reveal">
      <span class="eyebrow" style="justify-content:center;color:var(--gold-soft)">No cost</span>
      <h2>Try before you buy</h2>
      <p>Skill sheets, anchor chart posters, back-to-school tools, curriculum maps, and end-of-year reviews — all free on Teachers Pay Teachers. Start here before spending a dollar.</p>
      <div class="ctaband__btns">
        <a class="btn btn--primary" href="/free.html">Browse free resources ${ICON.arrow}</a>
        <a class="btn btn--on-dark" href="/catalog.html">Browse the catalog</a>
      </div>
    </div>
  </section>
</main>
` + footer() + scripts();
}

/* ============================================================================
   PAGE: catalog
   ============================================================================ */
function pageCatalog() {
  // strands present, in canonical order
  const order = ['EE', 'NS', 'RP', 'SP', 'G', 'F'];
  const present = order.filter(s => products.some(p => p.strand === s));
  const strandChip = s =>
    `<button class="chip" data-filter-strand="${s}" aria-pressed="false">${STRAND_NAME[s]}</button>`;

  const gradeChip = (val, label) =>
    `<button class="chip${val === 'all' ? ' is-active' : ''}" data-filter-grade="${val}"${val !== 'all' ? ` data-grade="${val}"` : ''} aria-pressed="${val === 'all'}">${label}</button>`;

  // sort: grade then sheet number
  const sorted = products.slice().sort((a, b) => (a.grade - b.grade) || (Number(a.num) - Number(b.num)));

  return head({
    title: 'Middle School Math Skill Sheets — Grades 6, 7 & 8 CCSS | Math Class 678',
    desc: `Browse all ${counts.all} 4-in-1 Skill Sheets for middle school math — grades 6, 7, and 8, aligned to Common Core. Filter by grade, strand, or standard. Every sheet links directly to Teachers Pay Teachers.`,
    path: 'catalog.html',
    jsonld: breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Catalog', url: '/catalog.html' }])
  }) + nav('catalog') + `
<main id="main">
  ${breadcrumb([{ name: 'Home', url: '/' }, { name: 'Catalog' }])}
  <section class="page-hero catalog-page-hero">
    <div class="wrap page-hero__inner">
      <span class="eyebrow">The catalog</span>
      <h1>Every skill sheet, one place</h1>
      <p>All ${counts.all} 4-in-1 Skill Sheets across grades 6 to 8, sequenced by Common Core standard. Filter by grade or strand, or search by skill. Each card opens a page with the standard, the skill, and a link to Teachers Pay Teachers.</p>
      <p class="catalog-hero__gradelinks">Or jump to a grade hub: <a href="/grade-6.html">6th grade</a> · <a href="/grade-7.html">7th grade</a> · <a href="/grade-8.html">8th grade</a></p>
    </div>
  </section>
    <div class="wrap">
      <div class="catbar__row">
        <div class="filtergroup" role="group" aria-label="Filter by grade">
          <span class="filtergroup__label">Grade</span>
          ${gradeChip('all', 'All')}
          ${gradeChip('6', '6th')}
          ${gradeChip('7', '7th')}
          ${gradeChip('8', '8th')}
        </div>
        <div class="search">
          ${ICON.search}
          <input type="search" id="catalog-search" placeholder="Search a skill or standard…" aria-label="Search skill sheets">
        </div>
      </div>
      <div class="catbar__row" style="margin-top:.8rem">
        <div class="filtergroup" role="group" aria-label="Filter by strand">
          <span class="filtergroup__label">Strand</span>
          <button class="chip is-active" data-filter-strand="all" aria-pressed="true">All strands</button>
          ${present.map(strandChip).join('\n          ')}
        </div>
        <span class="catbar__count" id="catalog-count"><b>${counts.all}</b> sheets</span>
      </div>
    </div>
  </div>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="card-grid" id="catalog-grid">
        ${sorted.map(productCard).join('\n')}
      </div>
      <div class="catalog-empty" id="catalog-empty">
        <h3>No sheets match those filters</h3>
        <p>Try clearing the search or choosing a different grade.</p>
      </div>
    </div>
  </section>
</main>
` + footer() + scripts();
}

/* ============================================================================
   PAGE: per-grade landing pages — /grade-6.html, /grade-7.html, /grade-8.html
   Real SEO pages (not filtered catalog views): grade-specific hero, strand
   breakdown, full sheet grid grouped by strand, grade bundles, free CTA.
   ============================================================================ */
const GRADE_INTRO = {
  '6': {
    hero: 'Sixth grade is where arithmetic becomes algebra. Students meet ratios and unit rates, extend the number system to negatives and absolute value, write and evaluate expressions, solve one-step equations, and build the statistics and geometry foundations the next two years depend on.',
    strands: 'Across the sixth-grade catalog you will find every domain Common Core asks for: Ratios & Proportional Relationships, The Number System, Expressions & Equations, Statistics & Probability, and Geometry.'
  },
  '7': {
    hero: 'Seventh grade is the proportional-reasoning year. Students operate fluently with rational numbers and integers, work with proportional relationships and percent, solve two-step equations and inequalities, and move into probability, sampling, and the geometry of circles, angles, and scale.',
    strands: 'The seventh-grade catalog covers The Number System, Ratios & Proportional Relationships, Expressions & Equations, Statistics & Probability, and Geometry — sequenced the way the standards build.'
  },
  '8': {
    hero: 'Eighth grade is pre-algebra in everything but name. Students work with exponents and scientific notation, master slope and linear equations, solve systems, formalize the idea of a function, and tackle transformations, the Pythagorean Theorem, and bivariate data.',
    strands: 'The eighth-grade catalog spans Expressions & Equations, Functions, The Number System, Geometry, and Statistics & Probability — the full bridge into high-school algebra.'
  }
};

function pageGrade(grade) {
  const gO = gradeOrdinal(grade);
  const intro = GRADE_INTRO[grade] || { hero: '', strands: '' };
  const gradeSheets = products
    .filter(p => String(p.grade) === String(grade))
    .sort((a, b) => Number(a.num) - Number(b.num));
  const n = gradeSheets.length;

  // group by strand, in canonical order
  const strandOrder = ['RP', 'NS', 'EE', 'F', 'G', 'SP'];
  const present = strandOrder.filter(s => gradeSheets.some(p => p.strand === s));

  const strandSections = present.map(s => {
    const inStrand = gradeSheets.filter(p => p.strand === s);
    return `<section class="section grade-strand" style="padding-top:0">
    <div class="wrap">
      <div class="sec-head reveal">
        <div class="sec-head__t">
          <span class="eyebrow">${esc(STRAND_NAME[s])}</span>
          <h2>${esc(STRAND_NAME[s])}</h2>
          <p>${inStrand.length} ${inStrand.length === 1 ? 'skill sheet' : 'skill sheets'} in this strand for ${gO} grade.</p>
        </div>
      </div>
      <div class="card-grid">
        ${inStrand.map(productCard).join('\n        ')}
      </div>
    </div>
  </section>`;
  }).join('\n');

  // grade bundles (exclude the all-grades ULTIMATE)
  const gradeBundles = bundles.filter(b => String(b.grade) === String(grade));
  const bundleSection = gradeBundles.length ? `<section class="section bundles-band">
    <div class="wrap">
      <div class="sec-head reveal">
        <div class="sec-head__t">
          <span class="eyebrow">Buy in bulk</span>
          <h2>${gO} grade bundles</h2>
          <p>Grab a whole strand, a single topic, or the entire ${gO}-grade year at once — each a single download on Teachers Pay Teachers.</p>
        </div>
        <a class="btn btn--ghost reveal" href="/bundles.html">See all bundles ${ICON.arrow}</a>
      </div>
      <div class="card-grid">
        ${gradeBundles.map(bundleCard).join('\n        ')}
      </div>
    </div>
  </section>` : '';

  const accentName = { '6': 'teal', '7': 'coral', '8': 'navy' }[grade] || '';

  // schema: CollectionPage + ItemList + breadcrumb
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${gO} Grade Math Skill Sheets`,
    description: `${n} CCSS-aligned 4-in-1 Skill Sheets for ${gO} grade math.`,
    url: `${SITE_URL}/grade-${grade}.html`,
    isPartOf: { '@type': 'WebSite', name: 'Math Class 678', url: SITE_URL },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: n,
      itemListElement: gradeSheets.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: SITE_URL + p.pageUrl,
        name: p.name
      }))
    }
  };
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Catalog', item: SITE_URL + '/catalog.html' },
      { '@type': 'ListItem', position: 3, name: `Grade ${grade}`, item: `${SITE_URL}/grade-${grade}.html` }
    ]
  };
  const jsonld = JSON.stringify([itemList, crumbs]).replace(/</g, '\\u003c');

  return head({
    title: `${gO} Grade Math Skill Sheets — ${n} CCSS-Aligned Resources | Math Class 678`,
    desc: `${n} printable 4-in-1 Skill Sheets for ${gO} grade math, aligned to Common Core. Reference, practice, application, and assessment on one sheet per standard. Built by a 25-year teacher.`,
    path: `grade-${grade}.html`,
    jsonld
  }) + nav('catalog') + `
<main id="main" class="grade-page grade-page--${grade}">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <div class="wrap">
      <ol>
        <li><a href="/">Home</a></li>
        <li><a href="/catalog.html">Catalog</a></li>
        <li aria-current="page">${gO} Grade</li>
      </ol>
    </div>
  </nav>

  <section class="page-hero grade-hero grade-hero--${accentName}">
    <div class="wrap page-hero__inner">
      <span class="eyebrow">${gO} grade math · CCSS</span>
      <h1>${gO} Grade Math Skill Sheets</h1>
      <p>${esc(intro.hero)}</p>
      <p class="grade-hero__strands">${esc(intro.strands)}</p>
      <div class="hero__cta" style="margin-top:1.4rem">
        <a class="btn btn--primary" href="/catalog.html?grade=${grade}">Filter the catalog ${ICON.arrow}</a>
        <a class="btn btn--ghost" href="/free.html">Free ${gO}-grade resources</a>
      </div>
      <div class="hero__meta" style="margin-top:1.6rem">
        <span class="hero__stat"><b>${n}</b><span>Skill sheets</span></span>
        <span class="hero__stat"><b>${present.length}</b><span>Strands covered</span></span>
        <span class="hero__stat"><b>4</b><span>Phases per sheet</span></span>
      </div>
    </div>
  </section>

  ${strandSections}

  ${bundleSection}

  <section class="ctaband">
    <div class="wrap ctaband__inner reveal">
      <span class="eyebrow" style="justify-content:center;color:var(--gold-soft)">No cost</span>
      <h2>Try a ${gO}-grade sheet free</h2>
      <p>Start with the free resources before spending a dollar — skill sheets, anchor charts, curriculum maps, and more on Teachers Pay Teachers.</p>
      <div class="ctaband__btns">
        <a class="btn btn--primary" href="/free.html">Browse free resources ${ICON.arrow}</a>
        <a class="btn btn--on-dark" href="${TPT_STORE}" target="_blank" rel="noopener">Visit the TPT store</a>
      </div>
    </div>
  </section>
</main>
` + footer() + scripts();
}

/* ============================================================================
   PAGE: free
   ============================================================================ */
function pageFree() {
  const frees = products.filter(p => p.free).sort((a, b) => a.grade - b.grade);

  // Group FREE_RESOURCES by category in defined order
  const CAT_DEFS = [
    {
      key:    'Back to School',
      eyebrow:'Back to School',
      h2:     'Start the year strong',
      desc:   'Diagnostic tools, goal-setting worksheets, and first-day activities — everything you need for day one and the weeks that follow.'
    },
    {
      key:    'Classroom & Planning',
      eyebrow:'Classroom & Planning',
      h2:     'Resources for the wall and the plan book',
      desc:   'Anchor chart posters to keep up all year, a middle school math vocabulary word wall, and year-at-a-glance curriculum maps for 6th and 7th grade.'
    },
    {
      key:    'End of Year',
      eyebrow:'End of Year',
      h2:     'Finish the year with purpose',
      desc:   'Skills-check review worksheets for each grade, a student reflection activity, and a three-day emergency sub plan.'
    }
  ];
  const byCategory = {};
  FREE_RESOURCES.forEach(r => {
    if (!byCategory[r.cat]) byCategory[r.cat] = [];
    byCategory[r.cat].push(r);
  });

  return head({
    title: 'Free Middle School Math Resources — Grades 6, 7 & 8 | Math Class 678',
    desc:  'Free 4-in-1 Skill Sheets and classroom resources for middle school math teachers, grades 6–8. Combining Like Terms, anchor charts, curriculum maps, back-to-school tools, and more.',
    path:  'free.html',
    jsonld: breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Free Resources', url: '/free.html' }])
  }) + nav('free') + `
<main id="main">
  ${breadcrumb([{ name: 'Home', url: '/' }, { name: 'Free Resources' }])}

  <!-- HERO -->
  <section class="free-hero">
    <div class="hero__bg">${SVG.heroBg}</div>
    <div class="wrap">
      <div class="free-hero__wrap">
        <div class="free-hero__inner">
          <span class="eyebrow" style="color:var(--gold-soft)">No cost \u00b7 ready to use</span>
          <h1>Free resources from Math Class 678</h1>
          <p>Skill sheets, anchor chart posters, back-to-school tools, curriculum maps, and end-of-year reviews \u2014 all grades 6\u20138, all free on Teachers Pay Teachers.</p>
        </div>
        <div class="free-hero__photo">
          <img src="/assets/images/free_hero.jpg" alt="Free 4-in-1 Skill Sheet packets for 6th and 7th grade math with teal and coral accent bands" class="free-hero__img" width="1440" height="960" loading="lazy" decoding="async">
        </div>
      </div>
    </div>
  </section>

  <!-- FREE SKILL SHEETS (featured) -->
  <section class="section">
    <div class="wrap">
      <div class="rcat__head reveal">
        <span class="eyebrow">Free 4-in-1 Skill Sheets</span>
        <h2>The full method, no cost</h2>
        <p>Two complete 4-in-1 Skill Sheets \u2014 the same architecture as every paid sheet. A reference page, sixteen sequenced practice problems, real-world application, an exit ticket with answer key, and editable teacher slides. Nothing stripped out.</p>
      </div>
      <div class="free-grid">
        ${frees.map(productCard).join('\n')}
      </div>
    </div>
  </section>

  <!-- CATEGORY SECTIONS -->
  ${CAT_DEFS.map(c => {
    const items = byCategory[c.key] || [];
    return `
  <section class="section rcat-section">
    <div class="wrap">
      <div class="rcat__head reveal">
        <span class="eyebrow">${c.eyebrow}</span>
        <h2>${c.h2}</h2>
        <p>${c.desc}</p>
      </div>
      <div class="res-grid">
        ${items.map(freeResourceCard).join('\n')}
      </div>
    </div>
  </section>`;
  }).join('')}

  <!-- BOTTOM CTA -->
  <section class="section gridpaper">
    <div class="wrap">
      <div class="method__head reveal" style="margin-bottom:1.6rem">
        <span class="eyebrow">Full catalog</span>
        <h2>Ready to go further</h2>
        <p>103 4-in-1 Skill Sheets across grades 6\u20138. One skill per sheet, four learning phases, Common Core aligned.</p>
      </div>
      <a class="btn btn--ghost" href="/catalog.html">Browse the full catalog ${ICON.arrow}</a>
    </div>
  </section>

</main>
` + footer() + scripts();
}

/* ============================================================================
   PAGE: about
   ============================================================================ */
function pageAbout() {
  const founderSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About Math Class 678',
    url: SITE_URL + '/about.html',
    mainEntity: {
      '@type': 'Person',
      name: 'Greg',
      jobTitle: 'Middle School Math Teacher',
      image: SITE_URL + '/assets/images/founder_portrait.jpg',
      description: 'A middle school math teacher with more than 25 years in grades 6–8 classrooms, and the author of the Math Class 678 4-in-1 Skill Sheets.',
      worksFor: { '@type': 'Organization', name: 'Math Class 678', url: SITE_URL },
      knowsAbout: ['Middle school mathematics', 'Common Core State Standards', 'Grades 6-8 math instruction', 'Curriculum design']
    }
  }).replace(/</g, '\\u003c');

  return head({
    title: 'About the Teacher — Middle School Math Skill Sheets | Math Class 678',
    desc: 'Math Class 678 is written by Greg, a teacher with 25 years in middle school math. Every 4-in-1 Skill Sheet covers one Common Core standard for grades 6–8, built from real classroom experience.',
    path: 'about.html',
    jsonld: founderSchema
  }) + nav('about') + `
<main id="main">
  <section class="page-hero">
    <div class="wrap page-hero__inner">
      <span class="eyebrow">About</span>
      <h1>Built in a real classroom, not a content farm</h1>
      <p>Math Class 678 is a one-teacher studio. Every sheet comes out of twenty-five years of watching middle schoolers work through the same standards, make the same mistakes, and need the same things on the page.</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap about-grid">
      <div class="prose reveal">
        <p>I am Greg, and I have taught middle-school math for more than twenty-five years. In that time I have taught the same standards hundreds of times over — ratios in sixth grade, proportional reasoning in seventh, slope and linear functions in eighth — and watched class after class hit the same walls in the same places. <strong>Math Class 678</strong> is everything I learned in those years, turned into the resource I always wished I could hand a new teacher down the hall.</p>

        <p>The idea started the way most good classroom ideas do: out of frustration. I would find a reference chart I liked from one place, a practice worksheet from another, and a quiz from a third — and spend a prep period stitching three mismatched files into something coherent, only to do it again for the next skill the next week. So I built the thing I actually needed. One standard, one sheet, the whole lesson in one place.</p>

        <blockquote class="about-pull">
          <p>I did not set out to make worksheets. I set out to stop reinventing the same lesson every Sunday night.</p>
        </blockquote>

        <h2>Why one sheet per skill</h2>
        <p>Middle-school math breaks down into discrete, teachable skills, and each Common Core standard deserves its own complete treatment. Bundle ten skills into a forty-page packet and the structure of the math disappears; the student cannot see where one idea ends and the next begins. Split a single skill across a reference sheet, a worksheet, and a separate quiz and you spend the period hunting through three files. The 4-in-1 format keeps the whole arc of a skill — see it, practice it, apply it, prove it — in one printable you can hand out in thirty seconds.</p>

        <h2>The mistakes are the part you cannot fake</h2>
        <p>Anyone can generate practice problems. What twenty-five years actually buys you is knowing exactly how a thirteen-year-old will get a problem wrong. When students distribute, a predictable share of them will multiply the first term and forget the second. When they write inequalities, they will reverse the symbol for "at least." Those specific, recurring errors are baked into every sheet as common-misconception callouts with redirect language ready to use — because the hardest part of teaching a skill is not explaining it right, it is catching it going wrong.</p>

        <h2>Designed to survive your copier</h2>
        <p>Every reproduction page is built against a restrained two-color system so each line stays legible after a pass through a tired school Xerox at 7:40 in the morning. The layouts assume the realities of the job: the sub day, the fire drill, the kid who was absent, the copier that only does black and white. These are not decorative documents. They are made to be used hard.</p>

        <h2>How the catalog works</h2>
        <p>This site is a showcase and a directory. It sells nothing on its own — every sheet lives on <a href="${TPT_STORE}" target="_blank" rel="noopener">Teachers Pay Teachers</a>, and every button here routes you straight to the listing. Browse the <a href="/catalog.html">full catalog</a>, jump to your <a href="/grade-7.html">grade</a>, or start with the <a href="/free.html">free resources</a> before spending a dollar.</p>
      </div>
      <aside class="reveal">
        <figure class="about__figure">
          <img src="/assets/images/founder_portrait.jpg" alt="Greg, the founder of Math Class 678, standing in his middle school math classroom in front of anchor charts for exponent rules and the distributive property" class="about__photo about__photo--portrait" width="1100" height="1375" loading="lazy" decoding="async">
          <figcaption class="about__caption">Greg, in his own classroom — twenty-five years teaching grades 6 to 8 math.</figcaption>
        </figure>
        <div class="stat-block">
        <div class="stat-row"><b>25</b><span>Years teaching middle school math</span></div>
        <div class="stat-row"><b>${counts.all}</b><span>4-in-1 Skill Sheets across the catalog</span></div>
        <div class="stat-row"><b>${counts[6]}</b><span>Sixth-grade sheets</span></div>
        <div class="stat-row"><b>${counts[7]}</b><span>Seventh-grade sheets</span></div>
        <div class="stat-row"><b>${counts[8]}</b><span>Eighth-grade sheets</span></div>
        <div class="stat-row"><b>4</b><span>Learning phases on every sheet</span></div>
        </div>
        <figure class="about__figure about__figure--secondary">
          <img src="/assets/images/about_workspace.jpg" alt="A teacher's organized desk with a stack of skill sheets, open lesson planner, calculator, and warm afternoon light" class="about__photo" width="1440" height="960" loading="lazy" decoding="async">
          <figcaption class="about__caption">The studio where every sheet starts.</figcaption>
        </figure>
      </aside>
    </div>
  </section>

  <section class="ctaband">
    <div class="wrap ctaband__inner reveal">
      <h2>Browse the full collection</h2>
      <p>Every sheet, sequenced by standard and color-coded by grade.</p>
      <div class="ctaband__btns">
        <a class="btn btn--primary" href="/catalog.html">Open the catalog ${ICON.arrow}</a>
        <a class="btn btn--on-dark" href="${TPT_STORE}" target="_blank" rel="noopener">Visit the TPT store</a>
      </div>
    </div>
  </section>
</main>
` + footer() + scripts();
}

/* ============================================================================
   PAGE: contact
   ============================================================================ */
function pageContact() {
  const card = (ico, title, body, link, label) => `<article class="contact-card reveal">
      <span class="contact-card__ico">${ico}</span>
      <h3>${title}</h3>
      <p>${body}</p>
      <a href="${link}"${link.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${label}</a>
    </article>`;
  return head({
    title: 'Contact — Math Class 678',
    desc: 'Questions or custom requests for Math Class 678? Reach the studio by email, or follow along on Pinterest and Instagram for new 4-in-1 Skill Sheet launches.',
    path: 'contact.html'
  }) + nav('contact') + `
<main id="main">
  <section class="page-hero">
    <div class="wrap page-hero__inner">
      <span class="eyebrow">Contact</span>
      <h1>Questions or a custom request</h1>
      <p>Reach out any time — about a specific skill, a custom sheet, or anything you would like to see added to the catalog. Every message reaches the teacher behind the studio.</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="contact-grid">
        ${card(ICON.mail, 'Support', 'Help with a sheet you have downloaded, or a question about the method.', 'mailto:' + CONTACT.support, CONTACT.support)}
        ${card(ICON.mail, 'Custom requests', 'Want a sheet for a skill not yet in the catalog? Tell me what you need.', 'mailto:' + CONTACT.tpt, CONTACT.tpt)}
        ${card(ICON.store, 'TPT store', 'Every sheet, with previews and reviews, on Teachers Pay Teachers.', TPT_STORE, 'Visit the store')}
        ${card(ICON.pin, 'Pinterest', 'New launches, classroom ideas, and printable previews.', SOCIAL.pinterest, '@mathclass678')}
        ${card(ICON.ext, 'Instagram', 'Behind the sheets and new releases as they go live.', SOCIAL.instagram, '@mathclass.678')}
        ${card(ICON.ext, 'TikTok', 'Quick classroom tips and a look at the sheets in action.', SOCIAL.tiktok, '@mathclass678')}
      </div>
    </div>
  </section>
</main>
` + footer() + scripts();
}

/* ============================================================================
   PAGE: 404
   ============================================================================ */
function page404() {
  return head({ title: 'Page not found — Math Class 678', desc: 'That page could not be found.', path: '404.html' })
    + nav('') + `
<main id="main">
  <section class="section" style="text-align:center; padding-block:6rem">
    <div class="wrap">
      <span class="eyebrow" style="justify-content:center">Error 404</span>
      <h1 style="font-size:var(--fs-h1); margin-top:1rem">That page wandered off</h1>
      <p style="color:var(--charcoal-soft); max-width:46ch; margin:1rem auto 2rem">The page you were looking for is not here. Head back to the catalog or the homepage.</p>
      <div style="display:flex; gap:.8rem; justify-content:center; flex-wrap:wrap">
        <a class="btn btn--primary" href="/catalog.html">Browse the catalog ${ICON.arrow}</a>
        <a class="btn btn--ghost" href="/">Go home</a>
      </div>
    </div>
  </section>
</main>
` + footer() + scripts();
}

/* ============================================================================
   PAGE: get-started — standalone Kit lead-magnet landing page
   Minimal nav (brand only), single conversion focus, no Kit band in footer.
   Destination for Pinterest pins and any future paid traffic.
   ============================================================================ */
function navMinimal() {
  return `<header class="nav nav--minimal">
  <div class="wrap nav__inner">
    <a class="brand" href="/" aria-label="Math Class 678 home">
      <span class="brand__mark">${SVG.mark}</span>
      <span class="brand__text">
        <span class="brand__name">math class 678</span>
        <span class="brand__sub">4-in-1 skill sheets</span>
      </span>
    </a>
    <a class="nav__link" href="/catalog.html">Browse the catalog ${ICON.arrow}</a>
  </div>
</header>`;
}

function pageGetStarted() {
  return head({
    title: 'Get a Free 4-in-1 Skill Sheet — Middle School Math | Math Class 678',
    desc: 'Sign up and get a complete 4-in-1 Skill Sheet free: Combining Like Terms for 6th grade. Reference, practice, application, and an exit ticket with answer key. Built by a 25-year teacher.',
    path: 'get-started.html'
  }) + navMinimal() + `
<main id="main" class="landing">
  <section class="landing-hero">
    <div class="wrap landing-hero__grid">
      <div class="landing-hero__copy reveal">
        <span class="eyebrow">Free 4-in-1 Skill Sheet</span>
        <h1>A complete math lesson, on the house</h1>
        <p class="landing-hero__lead">Sign up and I'll send you the <strong>Combining Like Terms</strong> 4-in-1 Skill Sheet for 6th grade — the same format I have used in my own classroom for twenty-five years. One standard, one printable, the whole lesson in your hand.</p>
        <ul class="landing__list">
          <li><strong>Reference page</strong> students keep — definitions, rules, a worked example, and a visual model</li>
          <li><strong>Scaffolded practice</strong> from guided notes to sixteen sequenced problems</li>
          <li><strong>Real-world application</strong> problems that match how students actually see the skill</li>
          <li><strong>Exit ticket</strong> with a full answer key, so you know who is ready before tomorrow</li>
          <li><strong>Editable teacher slides</strong> with speaker notes, ready for first instruction</li>
        </ul>
        <p class="landing__reassure">No spam. You will hear from me when new sheets publish and when the store runs a sale — and you can unsubscribe in one click anytime.</p>
      </div>
      <aside class="landing-hero__form reveal">
        <div class="landing-form-card">
          <span class="landing-form-card__eyebrow">Send it to my inbox</span>
          <h2 class="landing-form-card__title">Get the free sheet</h2>
          <p class="landing-form-card__sub">Enter your email and the Combining Like Terms 4-in-1 Skill Sheet is yours.</p>
          <div class="landing-form-card__form">
            ${KIT_SCRIPT}
          </div>
        </div>
      </aside>
    </div>
  </section>

  <section class="landing-trust">
    <div class="wrap landing-trust__row">
      <div class="landing-trust__item"><b>25</b><span>Years in the classroom</span></div>
      <div class="landing-trust__item"><b>${counts.all}</b><span>Skill sheets, grades 6–8</span></div>
      <div class="landing-trust__item"><b>4</b><span>Phases on every sheet</span></div>
      <div class="landing-trust__item"><b>CCSS</b><span>Aligned to the standards</span></div>
    </div>
  </section>

  <section class="section landing-why">
    <div class="wrap">
      <div class="sec-head reveal">
        <div class="sec-head__t">
          <span class="eyebrow">Why teachers sign up</span>
          <h2>See the format before you buy a thing</h2>
          <p>The free sheet is a real, complete 4-in-1 Skill Sheet — not a sample with the good parts removed. Use it with a class, see how the four phases hold together, and decide for yourself whether the rest of the catalog earns a place in your plans.</p>
        </div>
      </div>
      <div class="ctaband__btns" style="justify-content:flex-start">
        <a class="btn btn--ghost" href="/free.html">See all free resources ${ICON.arrow}</a>
        <a class="btn btn--ghost" href="/catalog.html">Browse the full catalog</a>
      </div>
    </div>
  </section>
</main>
` + footer({ noKit: true }) + scripts();
}

/* ============================================================================
   PAGE: individual sheet landing pages (one per product) — SEO surface
   ============================================================================ */
function gradeOrdinal(g) { return ({ '6': '6th', '7': '7th', '8': '8th' })[g] || (g + 'th'); }

/* Descriptive, keyword-rich alt text for sheet thumbnails — doubles as
   Pinterest SEO and accessibility. Includes grade, skill, strand, and standard. */
function sheetAlt(p) {
  const gO = gradeOrdinal(p.grade);
  const strand = (typeof STRAND_NAME !== 'undefined' && STRAND_NAME[p.strand]) ? STRAND_NAME[p.strand] : '';
  const strandPart = strand ? `${strand}, ` : '';
  return `${gO} grade math ${p.name} 4-in-1 Skill Sheet \u2014 ${strandPart}Common Core standard ${p.ccss}. Reference, practice, application, and assessment on one printable from Math Class 678.`;
}

/* Reusable breadcrumb: visible nav + matching BreadcrumbList JSON-LD.
   crumbs = [{name, url} ...]; the last item is treated as current (no link). */
function breadcrumb(crumbs) {
  const items = crumbs.map((c, i) => {
    const last = i === crumbs.length - 1;
    return last
      ? `<li aria-current="page">${esc(c.name)}</li>`
      : `<li><a href="${c.url}">${esc(c.name)}</a></li>`;
  }).join('\n        ');
  return `<nav class="breadcrumb" aria-label="Breadcrumb">
    <div class="wrap">
      <ol>
        ${items}
      </ol>
    </div>
  </nav>`;
}
function breadcrumbSchema(crumbs) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url ? (c.url.startsWith('http') ? c.url : SITE_URL + (c.url.startsWith('/') ? c.url : '/' + c.url)) : undefined
    }))
  }).replace(/</g, '\\u003c');
}

function sheetJsonLd(p) {
  const canonical = SITE_URL + p.pageUrl;
  const img = p.hasThumb ? p.thumbAbs : (SITE_URL + '/assets/images/og_image.png');
  const ccssDotted = `CCSS.MATH.CONTENT.${p.ccss}`;
  const learning = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: `${p.name} — 4-in-1 Skill Sheet`,
    description: p.about,
    url: canonical,
    image: img,
    learningResourceType: '4-in-1 Skill Sheet (Reference, Practice, Apply, Assess)',
    educationalUse: ['instruction', 'practice', 'assessment'],
    educationalLevel: `Grade ${p.grade}`,
    teaches: p.ccssText || p.name,
    educationalAlignment: {
      '@type': 'AlignmentObject',
      alignmentType: 'teaches',
      educationalFramework: 'Common Core State Standards',
      targetName: ccssDotted,
      targetDescription: p.ccssText || undefined
    },
    inLanguage: 'en',
    isAccessibleForFree: !!p.free,
    audience: { '@type': 'EducationalAudience', educationalRole: 'teacher' },
    provider: { '@type': 'Organization', name: 'Math Class 678', url: SITE_URL }
  };
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Catalog', item: SITE_URL + '/catalog.html' },
      { '@type': 'ListItem', position: 3, name: `Grade ${p.grade}`, item: `${SITE_URL}/catalog.html?grade=${p.grade}` },
      { '@type': 'ListItem', position: 4, name: p.name, item: canonical }
    ]
  };
  return JSON.stringify([learning, crumbs]).replace(/</g, '\\u003c');
}


/* ============================================================================
   PAGE: individual standard content pages — /standards/{slug}.html
   Teacher-facing: explanation, worked examples, common mistakes, tip, skill CTA
   ============================================================================ */
function pageStandard(std) {
  const ccss    = std.ccss;
  const grade   = std.grade;
  const gO      = gradeOrdinal(grade);
  const gradeCls = `sheet--${grade}`;
  const strandN = STRAND_NAME[std.strand] || std.strand;
  const ccssText = CCSS_TEXT[ccss] || '';
  const errors  = STD_ERRORS[ccss] || [];

  // Linked products
  const linkedProducts = (std.sheets || [])
    .map(num => products.find(p => String(p.num) === String(num)))
    .filter(Boolean);

  // Page title: short formula keeps all 93 standards pages under 70 chars (Bing/Google threshold).
  // 4 titles exceed 70 even with the short formula — page-title-only overrides below; H1 unchanged.
  const STD_TITLE_SHORT = {
    '6.G.A.3': 'Coordinate Plane Polygons & Quadrilaterals',
    '7.EE.A.1': 'Like Terms & the Distributive Property',
    '6.NS.B.4': 'Greatest Common Factor & LCM',
    '6.NS.C.7': 'Comparing Rationals & Absolute Value',
  };
  const titleBase = STD_TITLE_SHORT[ccss] || std.title;
  const title    = `${titleBase} — ${ccss} | Math Class 678`;
  const metaDesc = `Classroom-tested explanation, worked examples, and common mistakes for ${ccss} ${std.title}. Tips from a 25-year middle school math teacher.`.slice(0, 158);

  // Explanation paragraphs
  const explanHtml = (std.explanation || []).map(p => `<p>${esc(p)}</p>`).join('\n          ');

  // Worked examples
  const examplesHtml = (std.examples || []).map((ex, i) => `
          <div class="std-example">
            <div class="std-example__head">
              <span class="std-example__num">Example ${i + 1}</span>
              ${ex.label ? `<span class="std-example__label">${esc(ex.label)}</span>` : ''}
            </div>
            <div class="std-example__problem">${esc(ex.problem)}</div>
            <div class="std-example__steps">
              ${(ex.steps || []).map((s, si) => `<div class="std-example__step"><span class="std-example__stepnum">Step ${si + 1}</span><span class="std-example__steptext">${esc(s)}</span></div>`).join('\n              ')}
            </div>
            <div class="std-example__answer"><span class="std-example__answerlabel">Answer</span><span class="std-example__answerval">${esc(ex.answer)}</span></div>
          </div>`).join('');

  // Common mistakes
  const mistakesHtml = errors.length ? errors.map(e => `
          <div class="mistake-card">
            <div class="mistake-card__wrong">
              <span class="mistake-card__tag">What students write</span>
              <span class="mistake-card__work">${esc(e.wrong)}</span>
            </div>
            <div class="mistake-card__fix">
              <span class="mistake-card__tag mistake-card__tag--fix">The fix</span>
              <span class="mistake-card__work">${esc(e.fix)}</span>
            </div>
            ${e.prompt ? `<div class="mistake-card__prompt">
              <span class="mistake-card__tag mistake-card__tag--prompt">Try this</span>
              <span class="mistake-card__prompttext">${esc(e.prompt)}</span>
            </div>` : ''}
          </div>`).join('') : '';

  // Skill-sheet CTA cards
  const sheetCTAHtml = linkedProducts.map(p => {
    const cta = p.live
      ? `<a class="btn btn--primary" href="${p.pageUrl}" aria-label="See the ${esc(p.name)} 4-in-1 Skill Sheet">See the 4-in-1 Skill Sheet ${ICON.arrow}</a>`
      : `<span class="btn btn--ghost is-disabled" aria-disabled="true">Coming soon</span>`;
    return `<div class="std-sheet-cta">
        <div class="std-sheet-cta__media">
          <div class="pcard__art" aria-hidden="true">
            <div class="pcard__art-top"><span class="pcard__art-eyebrow">4-in-1 Skill Sheet</span><span class="pcard__art-wm">${esc(p.gradeLabel)}</span></div>
            <div class="pcard__art-body"><span class="pcard__art-quad">${SVG.cardQuad}</span><span class="pcard__art-skill">${esc(p.name)}</span><span class="pcard__art-sub">Reference · Practice · Apply · Assess</span></div>
            <div class="pcard__art-bottom"></div>
          </div>
          ${p.hasThumb ? `<img src="${p.thumbWeb}" alt="${esc(sheetAlt(p))}" width="600" height="600" loading="lazy" decoding="async" onerror="this.style.display='none'">` : ''}
        </div>
        <div class="std-sheet-cta__body">
          <div class="std-sheet-cta__meta"><span class="sheet-chip sheet-chip--ccss">${esc(p.ccss)}</span><span class="sheet-chip">${esc(p.gradeLabel)}</span></div>
          <h3 class="std-sheet-cta__name">${esc(p.name)}</h3>
          ${cta}
        </div>
      </div>`;
  }).join('');

  // JSON-LD
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${std.title} Teaching Tips — ${ccss}`,
    description: metaDesc,
    url: SITE_URL + `/standards/${std.slug}.html`,
    author: { '@type': 'Person', name: 'Math Class 678', url: SITE_URL },
    educationalAlignment: {
      '@type': 'AlignmentObject', alignmentType: 'teaches',
      educationalFramework: 'Common Core State Standards',
      targetName: `CCSS.MATH.CONTENT.${ccss}`
    },
    audience: { '@type': 'EducationalAudience', educationalRole: 'teacher' }
  }).replace(/</g, '\\u003c');

  return head({
    title, desc: metaDesc,
    path: `standards/${std.slug}.html`,
    jsonld: jsonLd
  }) + nav('catalog') + `
<main id="main" class="std-page ${gradeCls}">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <div class="wrap">
      <ol>
        <li><a href="/">Home</a></li>
        <li><a href="/catalog.html">Catalog</a></li>
        <li><a href="/catalog.html?grade=${grade}">${gO} Grade</a></li>
        <li aria-current="page">${esc(ccss)}</li>
      </ol>
    </div>
  </nav>

  <section class="section std-hero">
    <div class="wrap std-hero__inner">
      <div class="std-hero__chips">
        <span class="sheet-chip sheet-chip--ccss">${esc(ccss)}</span>
        <span class="sheet-chip">${esc(gO)} Grade</span>
        <span class="sheet-chip">${esc(strandN)}</span>
      </div>
      <h1 class="std-hero__title">${esc(std.title)}</h1>
      <p class="std-hero__standard">${esc(ccssText)}</p>
    </div>
  </section>

  <section class="section std-content">
    <div class="wrap std-content__grid">
      <div class="std-content__main">

        <div class="std-block">
          <h2>How to explain it</h2>
          ${explanHtml}
        </div>

        ${examplesHtml ? `<div class="std-block">
          <h2>Worked examples</h2>
          <div class="std-examples">${examplesHtml}
          </div>
        </div>` : ''}

        ${mistakesHtml ? `<div class="std-block">
          <h2>Common mistakes</h2>
          <div class="std-mistakes">${mistakesHtml}
          </div>
        </div>` : ''}

        <div class="std-block">
          <h2>Teacher tip</h2>
          <p class="std-tip">${esc(std.tip || '')}</p>
        </div>

      </div>

      <aside class="std-content__side">
        ${sheetCTAHtml ? `<div class="std-side-block">
          <h2 class="std-side-block__title">The skill sheet</h2>
          ${sheetCTAHtml}
        </div>` : ''}
      </aside>
    </div>
  </section>

</main>
` + footer() + scripts();
}


function pageSheet(p, prev, next) {
  const imgPath = p.thumbWeb;
  const ogImg = p.hasThumb ? p.thumbAbs : (SITE_URL + '/assets/images/og_image.png');
  const gO = gradeOrdinal(p.grade);
  // SEO title + meta description
  const title = `${p.name} — ${gO} Grade Math Skill Sheet (${p.ccss}) | Math Class 678`;
  const metaDesc = (p.about.length > 158 ? p.about.slice(0, 155).trim() + '…' : p.about);

  const cta = p.live
    ? `<a class="btn btn--primary sheet__tpt" href="${p.url}" target="_blank" rel="noopener" aria-label="${esc(p.free ? 'Get this free sheet' : 'View')} ${esc(p.name)} on Teachers Pay Teachers">${p.free ? 'Get it free on TPT' : 'View on Teachers Pay Teachers'} ${ICON.ext}</a>`
    : `<span class="btn btn--ghost is-disabled" aria-disabled="true">Coming soon</span>`;

  const navPrev = prev ? `<a class="sheetnav__link sheetnav__prev" href="${prev.pageUrl}"><span class="sheetnav__dir">Previous</span><span class="sheetnav__name">${esc(prev.name)}</span></a>` : '<span class="sheetnav__link is-empty"></span>';
  const navNext = next ? `<a class="sheetnav__link sheetnav__next" href="${next.pageUrl}"><span class="sheetnav__dir">Next</span><span class="sheetnav__name">${esc(next.name)}</span></a>` : '<span class="sheetnav__link is-empty"></span>';

  return head({
    title,
    desc: metaDesc,
    path: `sheets/${p.pageSlug}.html`,
    ogImage: ogImg,
    ogType: 'article',
    jsonld: sheetJsonLd(p)
  }) + nav('catalog') + `
<main id="main" class="sheet sheet--${p.grade}">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <div class="wrap">
      <ol>
        <li><a href="/">Home</a></li>
        <li><a href="/catalog.html">Catalog</a></li>
        <li><a href="/catalog.html?grade=${p.grade}">Grade ${p.grade}</a></li>
        <li aria-current="page">${esc(p.name)}</li>
      </ol>
    </div>
  </nav>

  <section class="section sheet-hero">
    <div class="wrap sheet-hero__grid">
      <div class="sheet-hero__media">
        <div class="pcard__art" aria-hidden="true">
          <div class="pcard__art-top">
            <span class="pcard__art-eyebrow">4-in-1 Skill Sheet</span>
            <span class="pcard__art-wm">${p.grade}th grade</span>
          </div>
          <div class="pcard__art-body">
            <span class="pcard__art-quad">${SVG.cardQuad}</span>
            <span class="pcard__art-skill">${esc(p.name)}</span>
            <span class="pcard__art-sub">Reference · Practice · Apply · Assess</span>
          </div>
          <div class="pcard__art-bottom"></div>
        </div>
        ${p.hasThumb ? `<img src="${imgPath}" alt="${esc(sheetAlt(p))}" width="600" height="600" loading="eager" fetchpriority="high" decoding="async" onerror="this.style.display='none'">` : ''}
        ${p.free ? '<span class="pcard__badge sheet__badge">Free</span>' : ''}
      </div>
      <div class="sheet-hero__copy">
        <div class="sheet-hero__tags">
          <span class="sheet-chip sheet-chip--ccss">${esc(p.ccss)}</span>
          <span class="sheet-chip">Grade ${p.grade}</span>
          <span class="sheet-chip">${esc(p.strandName)}</span>
        </div>
        <h1>${esc(p.name)}</h1>
        ${p.desc ? `<p class="sheet-hero__ican">${esc(p.desc)}</p>` : ''}
        <div class="sheet-hero__cta">
          ${cta}
          <a class="btn btn--ghost" href="/catalog.html?grade=${p.grade}">Back to ${gO} grade ${ICON.arrow}</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section sheet-detail" style="padding-top:0">
    <div class="wrap sheet-detail__grid">
      <div class="sheet-detail__main">
        <div class="sheet-block">
          <h2>About this skill sheet</h2>
          <p>${esc(p.about)}</p>
        </div>
        <div class="sheet-block">
          <h2>What is inside</h2>
          <p>Every 4-in-1 Skill Sheet moves a student through four phases on a single printable: a color <strong>Reference</strong> page to keep, scaffolded <strong>Practice</strong> from guided notes to sixteen sequenced problems, real-world <strong>Apply</strong> problems, and an <strong>Assess</strong> exit ticket with a full answer key. A ten-slide editable teacher deck with speaker notes is included.</p>
        </div>
      </div>
      <aside class="sheet-detail__side">
        <div class="sheet-facts">
          <h2 class="sheet-facts__title">Standard</h2>
          <div class="sheet-facts__ccss">${esc(p.ccss)}</div>
          ${p.ccssText ? `<p class="sheet-facts__text">${esc(p.ccssText)}</p>` : ''}
          ${standardsMap[p.ccss] ? `<a class="std-backlink" href="/standards/${standardsMap[p.ccss].slug}.html">Teaching tips for ${esc(p.ccss)} ${ICON.arrow}</a>` : ''}
          <dl class="sheet-facts__dl">
            <div><dt>Grade</dt><dd>${esc(p.gradeLabel)}</dd></div>
            <div><dt>Strand</dt><dd>${esc(p.strandName)}</dd></div>
            <div><dt>Format</dt><dd>4-in-1 Skill Sheet</dd></div>
            ${p.free ? '<div><dt>Price</dt><dd>Free on TPT</dd></div>' : ''}
          </dl>
          ${cta}
        </div>
      </aside>
    </div>
  </section>

  ${(() => {
    const inB = bundlesBySheet[String(p.num)] || [];
    if (!inB.length) return '';
    const chips = inB.map(b => `<a class="bundle-chip" href="${b.pageUrl}">${esc(b.name)} <span class="bundle-chip__n">${b.count}</span></a>`).join('');
    return `<section class="section sheet-bundles" style="padding-top:0">
    <div class="wrap">
      <h2 class="sheet-bundles__title">Save with a bundle</h2>
      <p class="sheet-bundles__lead">This skill sheet is included in these bundles. Buy the bundle to get this skill plus related ones in one download.</p>
      <div class="bundle-chips">${chips}</div>
    </div>
  </section>`;
  })()}

  ${kitHero({ eyebrow: 'Try before you buy', heading: 'Get a free 4-in-1 Skill Sheet', lead: 'Want to see the format in your own hands first? Enter your email and I\u2019ll send you the Combining Like Terms 4-in-1 Skill Sheet for 6th grade \u2014 a complete lesson on one printable, free.' })}

  <nav class="section sheetnav" aria-label="Browse adjacent sheets" style="padding-top:0">
    <div class="wrap sheetnav__row">
      ${navPrev}
      ${navNext}
    </div>
  </nav>
</main>
` + footer() + scripts();
}
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect x="4" y="4" width="42" height="42" rx="8" fill="#1A3C34"/>
<rect x="54" y="4" width="42" height="42" rx="8" fill="#D4A017"/>
<rect x="4" y="54" width="42" height="42" rx="8" fill="#3FA9A2"/>
<rect x="54" y="54" width="42" height="42" rx="8" fill="#D85D5D"/></svg>`;

/* ============================================================================
   BUNDLE pages: /bundles.html section + one landing page per bundle
   ============================================================================ */
function bundleTierLabel(b) {
  return ({ mega: 'Full-year bundle', ultimate: 'Everything bundle', strand: 'Strand bundle', topic: 'Topic bundle' })[b.tier] || 'Bundle';
}

function bundleCard(b) {
  const cls = `pcard bcard bcard--${b.grade === 'all' ? 'all' : b.grade}${b.tier === 'mega' || b.tier === 'ultimate' ? ' bcard--feature' : ''}`;
  const search = (b.name + ' ' + b.gradeLabel + ' bundle').toLowerCase();
  return `<article class="${cls}" data-grade="${b.grade}" data-search="${esc(search)}">
      <div class="pcard__media bcard__media">
        <div class="pcard__art" aria-hidden="true">
          <div class="pcard__art-top"><span class="pcard__art-eyebrow">${bundleTierLabel(b)}</span><span class="pcard__art-wm">${esc(b.gradeLabel)}</span></div>
          <div class="pcard__art-body"><span class="pcard__art-quad">${SVG.cardQuad}</span><span class="pcard__art-skill">${esc(b.name)}</span></div>
          <div class="pcard__art-bottom"></div>
        </div>
        ${b.hasThumb ? `<img src="${b.thumbWeb}" alt="${esc(b.name)} — ${b.count} 4-in-1 Skill Sheets" width="600" height="600" loading="lazy" decoding="async" onerror="this.style.display='none'">` : ''}
        <span class="pcard__badge bcard__badge">${b.count} sheets</span>
      </div>
      <div class="pcard__body">
        <div class="pcard__meta"><span class="pcard__grade">${esc(b.gradeLabel)}</span><span class="pcard__strand">${bundleTierLabel(b)}</span></div>
        <h3 class="pcard__name">${esc(b.name)}</h3>
        <div class="pcard__foot">
          <span class="pcard__bundle">${b.count} skill sheets</span>
          <a class="pcard__tpt pcard__cta" href="${b.pageUrl}" aria-label="View ${esc(b.name)} (${b.count} sheets)">View bundle ${ICON.arrow}</a>
        </div>
      </div>
    </article>`;
}

function bundleJsonLd(b) {
  const canonical = SITE_URL + b.pageUrl;
  const parts = b.members.map(p => ({
    '@type': 'LearningResource',
    name: `${p.name} — 4-in-1 Skill Sheet`,
    url: SITE_URL + p.pageUrl,
    educationalLevel: `Grade ${p.grade}`,
    educationalAlignment: {
      '@type': 'AlignmentObject', alignmentType: 'teaches',
      educationalFramework: 'Common Core State Standards',
      targetName: `CCSS.MATH.CONTENT.${p.ccss}`
    }
  }));
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: `${b.name} — 4-in-1 Skill Sheets Bundle`,
    description: b.blurb,
    url: canonical,
    image: b.thumbAbs,
    learningResourceType: 'Skill sheet bundle',
    educationalUse: ['instruction', 'practice', 'assessment'],
    educationalLevel: b.grade === 'all' ? 'Grades 6-8' : `Grade ${b.grade}`,
    inLanguage: 'en',
    isAccessibleForFree: false,
    audience: { '@type': 'EducationalAudience', educationalRole: 'teacher' },
    provider: { '@type': 'Organization', name: 'Math Class 678', url: SITE_URL },
    hasPart: parts
  };
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Bundles', item: SITE_URL + '/bundles.html' },
      { '@type': 'ListItem', position: 3, name: b.name, item: canonical }
    ]
  };
  return JSON.stringify([collection, crumbs]).replace(/</g, '\\u003c');
}

function pageBundle(b, prev, next) {
  const gradeCls = b.grade === 'all' ? 'sheet--ultimate' : `sheet--${b.grade}`;
  const title = `${b.name} Bundle — ${b.count} 4-in-1 Skill Sheets (${b.grade === 'all' ? 'Grades 6\u20138' : b.gradeLabel}) | Math Class 678`;
  const metaDesc = b.blurb.length > 158 ? b.blurb.slice(0, 155).trim() + '\u2026' : b.blurb;
  const cta = `<a class="btn btn--primary sheet__tpt" href="${b.url}" target="_blank" rel="noopener" aria-label="View ${esc(b.name)} bundle on Teachers Pay Teachers">View bundle on Teachers Pay Teachers ${ICON.ext}</a>`;
  const navPrev = prev ? `<a class="sheetnav__link sheetnav__prev" href="${prev.pageUrl}"><span class="sheetnav__dir">Previous bundle</span><span class="sheetnav__name">${esc(prev.name)}</span></a>` : '<span class="sheetnav__link is-empty"></span>';
  const navNext = next ? `<a class="sheetnav__link sheetnav__next" href="${next.pageUrl}"><span class="sheetnav__dir">Next bundle</span><span class="sheetnav__name">${esc(next.name)}</span></a>` : '<span class="sheetnav__link is-empty"></span>';

  return head({
    title, desc: metaDesc, path: `bundles/${b.slug}.html`,
    ogImage: b.thumbAbs, ogType: 'product', jsonld: bundleJsonLd(b)
  }) + nav('bundles') + `
<main id="main" class="sheet ${gradeCls}">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <div class="wrap"><ol>
      <li><a href="/">Home</a></li>
      <li><a href="/bundles.html">Bundles</a></li>
      <li aria-current="page">${esc(b.name)}</li>
    </ol></div>
  </nav>

  <section class="section sheet-hero">
    <div class="wrap sheet-hero__grid">
      <div class="sheet-hero__media">
        <div class="pcard__art" aria-hidden="true">
          <div class="pcard__art-top"><span class="pcard__art-eyebrow">${bundleTierLabel(b)}</span><span class="pcard__art-wm">${esc(b.gradeLabel)}</span></div>
          <div class="pcard__art-body"><span class="pcard__art-quad">${SVG.cardQuad}</span><span class="pcard__art-skill">${esc(b.name)}</span></div>
          <div class="pcard__art-bottom"></div>
        </div>
        ${b.hasThumb ? `<img src="${b.thumbWeb}" alt="${esc(b.name)} — ${b.count} 4-in-1 Skill Sheets bundle for ${b.grade === 'all' ? 'grades 6 to 8' : b.gradeLabel} math" width="600" height="600" loading="eager" fetchpriority="high" decoding="async" onerror="this.style.display='none'">` : ''}
      </div>
      <div class="sheet-hero__copy">
        <div class="sheet-hero__tags">
          <span class="sheet-chip sheet-chip--ccss">${b.count} skill sheets</span>
          <span class="sheet-chip">${esc(b.gradeLabel)}</span>
          <span class="sheet-chip">${bundleTierLabel(b)}</span>
        </div>
        <h1>${esc(b.name)}</h1>
        <p class="sheet-hero__ican">${esc(b.blurb)}</p>
        <div class="sheet-hero__cta">
          ${cta}
          <a class="btn btn--ghost" href="/bundles.html">All bundles ${ICON.arrow}</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section sheet-detail" style="padding-top:0">
    <div class="wrap">
      <div class="sheet-block">
        <h2>What is inside this bundle</h2>
        <p>${b.count} complete 4-in-1 Skill Sheets. Each one is a single printable that takes students through a color Reference page, scaffolded Practice, real-world Apply problems, and an Assess exit ticket with a full answer key. Select any skill below to see its standard and details.</p>
      </div>
      <div class="card-grid">
        ${b.members.map(productCard).join('\n')}
      </div>
    </div>
  </section>

  <nav class="section sheetnav" aria-label="Browse adjacent bundles" style="padding-top:0">
    <div class="wrap sheetnav__row">${navPrev}${navNext}</div>
  </nav>
</main>
` + footer() + scripts();
}

function pageBundles() {
  const feature = bundles.filter(b => b.tier === 'mega' || b.tier === 'ultimate')
    .sort((a, b) => (b.tier === 'ultimate') - (a.tier === 'ultimate') || a.grade.localeCompare(b.grade));
  const byGrade = g => bundles.filter(b => b.grade === g && b.tier !== 'mega');
  const section = (gradeNum, label) => {
    const items = byGrade(gradeNum);
    if (!items.length) return '';
    return `<section class="section bundles-grade" style="padding-top:0">
      <div class="wrap">
        <div class="bundles-grade__head"><h2>${label}</h2><a class="bundles-grade__all" href="/catalog.html?grade=${gradeNum}">Browse ${gradeNum}th grade catalog ${ICON.arrow}</a></div>
        <div class="card-grid">${items.map(bundleCard).join('\n')}</div>
      </div>
    </section>`;
  };
  return head({
    title: 'Middle School Math Skill Sheet Bundles — Grades 6, 7 & 8 | Math Class 678',
    desc: 'Save with 4-in-1 Skill Sheet bundles for grades 6, 7, and 8: strand bundles, topic bundles, full-year MEGA bundles, and the complete 103-sheet ULTIMATE bundle. All aligned to Common Core.',
    path: 'bundles.html',
    jsonld: breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Bundles', url: '/bundles.html' }])
  }) + nav('bundles') + `
<main id="main">
  ${breadcrumb([{ name: 'Home', url: '/' }, { name: 'Bundles' }])}
  <section class="section catalog-hero" style="background-image:linear-gradient(180deg, rgba(26,60,52,.86), rgba(26,60,52,.92)), url('/assets/images/catalog_header.png')">
    <div class="wrap">
      <span class="eyebrow eyebrow--light">Bundles</span>
      <h1>Buy by strand, topic, or the full year</h1>
      <p>Every 4-in-1 Skill Sheet, grouped into bundles so you can grab a whole strand or a full year at once. ${bundles.length} bundles across grades 6 to 8, each a single download on Teachers Pay Teachers. Open any bundle to see exactly which skills are inside.</p>
    </div>
  </section>

  <section class="section" style="padding-top:2.4rem">
    <div class="wrap">
      <div class="bundles-grade__head"><h2>Full-year and complete bundles</h2></div>
      <div class="card-grid">${feature.map(bundleCard).join('\n')}</div>
    </div>
  </section>

  ${section('6', '6th Grade Bundles')}
  ${section('7', '7th Grade Bundles')}
  ${section('8', '8th Grade Bundles')}
</main>
` + footer() + scripts();
}

function sitemap() {
  const pages = ['', 'catalog.html', 'bundles.html', 'grade-6.html', 'grade-7.html', 'grade-8.html', 'free.html', 'get-started.html', 'about.html', 'contact.html'];
  const today = new Date().toISOString().slice(0, 10);
  const main = pages.map(p => `  <url><loc>${SITE_URL}/${p}</loc><lastmod>${today}</lastmod></url>`);
  const sheets = products
    .filter(p => p.live)
    .map(p => `  <url><loc>${SITE_URL}${p.pageUrl}</loc><lastmod>${today}</lastmod></url>`);
  const bundleUrls = bundles
    .map(b => `  <url><loc>${SITE_URL}${b.pageUrl}</loc><lastmod>${today}</lastmod></url>`);
  const standardUrls = Object.values(STANDARDS_CONTENT)
    .map(s => `  <url><loc>${SITE_URL}/standards/${s.slug}.html</loc><lastmod>${today}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${main.concat(bundleUrls, sheets, standardUrls).join('\n')}
</urlset>`;
}
const robots = `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
// Netlify SPA-style fallback not needed (multipage); but ship a redirect for clean 404
const netlifyToml = `[[redirects]]\n  from = "/*"\n  status = 404\n  to = "/404.html"\n`;

/* ============================================================================
   write everything
   ============================================================================ */
function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function write(rel, content) {
  const full = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
function copy(srcRel, destRel) {
  fs.mkdirSync(path.dirname(path.join(DIST, destRel)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, srcRel), path.join(DIST, destRel));
}

rmrf(DIST);
fs.mkdirSync(DIST, { recursive: true });

write('index.html', pageHome());
write('catalog.html', pageCatalog());
write('bundles.html', pageBundles());
write('free.html', pageFree());
write('about.html', pageAbout());
write('contact.html', pageContact());
write('404.html', page404());
write('get-started.html', pageGetStarted());

/* per-grade landing pages — SEO hubs for "Nth grade math skill sheets" */
['6', '7', '8'].forEach(g => write(`grade-${g}.html`, pageGrade(g)));

/* individual bundle landing pages — ordered for prev/next (features first, then by grade) */
const bundleOrder = bundles.slice().sort((a, b) => {
  const rank = x => x.tier === 'ultimate' ? 0 : x.tier === 'mega' ? 1 : 2;
  return rank(a) - rank(b) || String(a.grade).localeCompare(String(b.grade)) || a.name.localeCompare(b.name);
});
let bundleCount = 0;
bundleOrder.forEach((b, i) => {
  write(`bundles/${b.slug}.html`, pageBundle(b, bundleOrder[i - 1], bundleOrder[i + 1]));
  bundleCount++;
});

/* individual sheet landing pages — ordered grade then sheet number, with prev/next */
const sheetOrder = products
  .filter(p => p.live) // live-gate: no page for pending products
  .sort((a, b) => (a.grade - b.grade) || (Number(a.num) - Number(b.num)));
let sheetCount = 0;
sheetOrder.forEach((p, i) => {
  write(`sheets/${p.pageSlug}.html`, pageSheet(p, sheetOrder[i - 1], sheetOrder[i + 1]));
  sheetCount++;
});

/* individual standard content pages */
let standardCount = 0;
Object.values(STANDARDS_CONTENT).forEach(std => {
  write(`standards/${std.slug}.html`, pageStandard(std));
  standardCount++;
});

copy('styles.css', 'assets/css/styles.css');
copy('assets/js/catalog.js', 'assets/js/catalog.js');

// Copy site-wide image assets (photos + graphics, not thumbs)
const SRC_SITE_IMGS = path.join(ROOT, 'assets', 'images');
let siteImgCount = 0;
if (fs.existsSync(SRC_SITE_IMGS)) {
  fs.readdirSync(SRC_SITE_IMGS)
    .filter(f => /\.(jpg|jpeg|png|svg|webp)$/i.test(f))
    .forEach(f => {
      copy(path.join('assets/images', f), path.join('assets/images', f));
      siteImgCount++;
    });
}

// Copy any product/bundle thumbnails present in the source thumbs dir (jpg or png)
const SRC_THUMBS = path.join(ROOT, 'assets', 'images', 'thumbs');
let thumbCount = 0;
if (fs.existsSync(SRC_THUMBS)) {
  fs.readdirSync(SRC_THUMBS).filter(f => /\.(jpe?g|png)$/i.test(f)).forEach(f => {
    copy(path.join('assets/images/thumbs', f), path.join('assets/images/thumbs', f));
    thumbCount++;
  });
}

// Copy bundle thumbnails (rename spaces -> underscores so web URLs need no encoding)
const SRC_BUNDLE_IMGS = path.join(ROOT, 'assets', 'images', 'bundles');
let bundleThumbCount = 0;
if (fs.existsSync(SRC_BUNDLE_IMGS)) {
  fs.readdirSync(SRC_BUNDLE_IMGS).filter(f => /\.(jpe?g|png)$/i.test(f)).forEach(f => {
    const webName = f.replace(/\s+/g, '_');
    copy(path.join('assets/images/bundles', f), path.join('assets/images/bundles', webName));
    bundleThumbCount++;
  });
}

// Copy freebie resource thumbnails (free_*.jpg naming convention)
const SRC_FREEBIE_IMGS = path.join(ROOT, 'assets', 'images', 'freebies');
let freebieThumbCount = 0;
if (fs.existsSync(SRC_FREEBIE_IMGS)) {
  fs.readdirSync(SRC_FREEBIE_IMGS).filter(f => /\.(jpe?g|png)$/i.test(f)).forEach(f => {
    copy(path.join('assets/images/freebies', f), path.join('assets/images/freebies', f));
    freebieThumbCount++;
  });
}

write('assets/images/favicon.svg', favicon);
write('assets/images/thumbs/.gitkeep', '# Drop product thumbnails here.\n# Web naming: thumb1_[grade]th_[slug].jpg  e.g. thumb1_6th_understanding-ratios.jpg\n# (.png also accepted; photo-content thumbs are optimized to JPEG on intake.)\n# Cards auto-pick them up on next build; CSS art shows until then.\n');
write('robots.txt', robots);
write('sitemap.xml', sitemap());
write('netlify.toml', netlifyToml);

/* expected thumbnail filenames manifest — marks which slots still need art */
const manifest = products.map(p => {
  const base = `thumb1_${p.grade}th_${p.slug}`;
  const status = p.hasThumb ? `[have .${p.thumbExt}]` : '[MISSING — CSS art fallback]';
  return `${base}.jpg  ·  #${p.num} ${p.name}  ${status}`;
}).join('\n');
const missingCount = products.filter(p => !p.hasThumb).length;
write('assets/images/thumbs/EXPECTED_FILENAMES.txt', `MC678 product thumbnail filenames (hero / thumb1 slot)\nWeb format: JPEG (photo-content thumbs). Place files in /assets/images/thumbs/.\nHave: ${products.length - missingCount} / ${products.length}   Missing: ${missingCount}\n\n${manifest}\n`);

console.log('Built dist/');
console.log('  Pages: index, catalog, bundles, free, about, contact, 404');
console.log('  Sheet landing pages:', sheetCount);
console.log('  Bundle landing pages:', bundleCount);
console.log('  Standard content pages:', standardCount);
console.log('  Products:', products.length, '| live:', live.length, '| free:', counts.free);
console.log('  Grades: 6th', counts[6], '· 7th', counts[7], '· 8th', counts[8]);
console.log('  Product thumbnails bundled:', thumbCount);
console.log('  Bundle thumbnails bundled:', bundleThumbCount);
console.log('  Freebie thumbnails bundled:', freebieThumbCount);
console.log('  Site asset images bundled:', siteImgCount);
