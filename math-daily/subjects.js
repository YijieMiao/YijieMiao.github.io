"use strict";
window.MathSubjects = (() => {
  const names = {"math.AC": "Commutative Algebra", "math.AG": "Algebraic Geometry", "math.AP": "Analysis of PDEs", "math.AT": "Algebraic Topology", "math.CA": "Classical Analysis and ODEs", "math.CO": "Combinatorics", "math.CT": "Category Theory", "math.CV": "Complex Variables", "math.DG": "Differential Geometry", "math.DS": "Dynamical Systems", "math.FA": "Functional Analysis", "math.GM": "General Mathematics", "math.GN": "General Topology", "math.GR": "Group Theory", "math.GT": "Geometric Topology", "math.HO": "History and Overview", "math.IT": "Information Theory", "math.KT": "K-Theory and Homology", "math.LO": "Logic", "math.MG": "Metric Geometry", "math.MP": "Mathematical Physics", "math.NA": "Numerical Analysis", "math.NT": "Number Theory", "math.OA": "Operator Algebras", "math.OC": "Optimization and Control", "math.PR": "Probability", "math.QA": "Quantum Algebra", "math.RA": "Rings and Algebras", "math.RT": "Representation Theory", "math.SG": "Symplectic Geometry", "math.SP": "Spectral Theory", "math.ST": "Statistics Theory"};
  const defaults = ['math.DG','math.MG','math.GT','math.AP','math.KT','math.MP'];
  function validate(value){if(!Array.isArray(value) || value.some(code=>typeof code!=='string' || !Object.hasOwn(names,code)))throw Error('方向设置格式不兼容');return [...new Set(value)];}
  const store=MathStorage.open('math-daily-subjects',validate,[]);
  let selected=store.value,hasSaved=store.blocked;
  try{hasSaved=hasSaved || localStorage.getItem('math-daily-subjects')!==null;}catch{}
  return {names,defaults,get hasSaved(){return hasSaved;},get warning(){return store.message;},get selected(){return selected.slice();},save(codes){
    selected=validate(codes.filter(code=>Object.hasOwn(names,code)));hasSaved=true;let saved=true;
    try{selected=store.write(selected);}catch{saved=false;}
    window.dispatchEvent(new Event('math-subjects-change'));return saved;
  },restore(){selected=store.restore();hasSaved=true;window.dispatchEvent(new Event('math-subjects-change'));return selected.slice();}};
})();
