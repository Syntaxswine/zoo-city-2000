// Tailored body layer, before heads, tails, wings and carried objects.
// Use the original pose's occupied cells so cuffs, feet and gait stay put.
export function suitBody(body, facing, cub = false) {
  const width = body[0].length;
  const shirt = [...body[0]].map((k, x) => "&^".includes(k) ? x : -1).filter(x => x >= 0);
  const centre = Math.floor((shirt[0] + shirt.at(-1)) / 2);
  const jacketEnd = cub ? 2 : 5;
  return body.map((row, y) => [...row].map((key, x) => {
    if (key === ".") return key;
    const lit = x < width / 2;
    if (y >= body.length - 1) return lit ? "%" : "<"; // polished shoes
    if (y >= jacketEnd) return lit ? ">" : "<"; // matching trousers
    if (!"&^".includes(key)) {
      return y < (cub ? 1 : 3) ? (lit ? "?" : ">") : key; // sleeves, then bare hands
    }
    let ink = lit ? "?" : ">";
    if (facing === "se") {
      if (y <= (cub ? 0 : 1) && Math.abs(x - centre) <= 1) ink = "("; // white collar and shirt
      if (x === centre && y < (cub ? 2 : 3)) ink = "A"; // burgundy tie
      if (!cub && (y === 1 && Math.abs(x - centre) === 2 || y === 2 && Math.abs(x - centre) === 1)) ink = "^"; // lapels
      if (!cub && y === 3 && x === centre) ink = "]"; // brass button
    }
    return ink;
  }).join(""));
}
