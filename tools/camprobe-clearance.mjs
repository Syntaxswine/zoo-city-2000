// Observe actual case closures each month, before the game's bounded history rolls.
// File identity matters: two incidents can share culprit, address and cause.
export function createClearanceTracker(caseMonths) {
  const closed = new WeakSet(), solved = new Set();
  return {
    observe(files, arrests, month) {
      const current = arrests.filter(a => !a.wrongful && a.tick === month);
      for (const f of files) {
        if (!f.closed || closed.has(f)) continue;
        closed.add(f);
        if (!['burglary', 'killing'].includes(f.cause) || month <= f.opened || month >= f.opened + caseMonths) continue;
        const match=current.findIndex(a => a.citizenId === f.culpritId && a.tile === f.tile && a.cause === f.cause);
        // A sale can close the culprit's remaining files because they died.
        // One conviction can only explain one closure, in filesTick's order.
        if (match>=0) { solved.add(f); current.splice(match,1); }
      }
    },
    get count() { return solved.size; },
  };
}
