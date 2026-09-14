# Governance

Build the **Governor’s Mansion** from the remote (`;`): one 3×3 public estate,
§3,000 construction, §360/year upkeep, and twelve jobs. It needs adjacent road
access and unlocks in Chapter 2 of Campaign; Free Play offers it immediately.
It has three architectural layouts and is separate from residential mansions.

The Governance tab is always visible beside Rules, Budget, Census and News in
the right-hand data panel. It shows annual commitments and city outcomes above
the current laws and programmes, even before an estate is built. Placement
unlocks policy changes, which require an unburned, unflooded estate with road
access. Enacted laws and funded programmes survive
damage or demolition; rebuild to change them. Policy decisions are saved,
recorded in News and the replay log, and cannot be undone through tile undo —
enacting one also clears the tile undo stack, and the notice says so.

"Governed" is derived, never stored: a town is governed while a mansion stands
or a law is on the books. Undo or bulldoze the estate before any law passes
and the town is exactly as ungoverned as before (the undone city hashes as the
city before the build). Earlier saves carry an `unlocked` key; it is read by
nothing. A town in receivership cannot enact anything, free or not — the county
holds the books, as for every other op.

| Decision | Effect | Cost |
| --- | --- | --- |
| Meat-hall regulation | Unregulated trade, inspected/taxed trade, or prohibition | Licensing §2,000 each enactment, then §400/hall/year |
| Sentencing | Separate rules for first/minor offences, second theft, murder, persistent theft | No enactment fee; facilities retain their upkeep |
| Equal treatment | Remove the affluent victim’s extra sentencing step | Free |
| Police accountability | Halve wrongful arrests and innocent interview collection probability | §300/year |
| Building cleaners | Household mess emissions −50%; visible wear reduced one stage | §6/standing zoned building/year |
| Factory scrubbers | Permanent industrial emissions −30% | §1,500 once |
| Food assistance | One food-support place per poor resident/camper, +3 mood, half their theft initiation and unemployed predation pressure | §12/recipient/year |
| Community activities | Cross-species friendship success ×1.5; +2 resident mood | §240 + §2/resident/year |

Sentencing defaults preserve the previous city rules. After the estate is
founded, police collection orders follow those laws instead of rolling an
alternative sentence. Equal treatment concerns sentencing; the existing
class-based investigation priorities remain separately modeled.

Imprisonment releases residents unchanged. Pacification permanently prevents
reproduction and predation. Sale kills the resident. Missing/full facilities
leave cases open. Laws apply to future decisions and do not reverse previous
convictions or permanent pacification.

Prohibiting trade closes hall jobs and transactions, ends the halls’ local
crime/dread effects, discards stock through the spoilage ledger, and releases
penned animals alive. Sale sentences are replaced by imprisonment while the
ban holds. Repealing it restores trading availability without replacing stock
or automatically rehiring workers.

In a town with **no Governor** the two old offers still come to the desk, as
they did before governance existed: the Scrubbers card (a roster event once 15
industrial lots stand) and the Butchers' licence (offered deterministically the
month the first hall reaches tier 2; SPEC §9c). Accepting them sets the same
flags Governance reads. A governed town gets no card; a card left on the desk
when the estate rose is referred to Governance without a charge. Striking the
cards outright (2026-09-12) had silently re-rolled every free-play city's event
stream past 15 industrial lots and made the licence cost a §3,000 mansion
nobody was told to build — restored by the hostile review of 2026-09-13.
Existing paid installations and licences survive loading, and so does a
pending card.
Budget includes every recurring programme, under the existing winter upkeep
modifier. Governance reports food support/shortfall, cumulative wrongful
convictions, pacification and sentence sales, and current cross-species ties.

Validation: `npm run check`, including `tools/check-governance.mjs`.
The art sheets regenerate with `node tools/review-building-variants.mjs`.
Save storage now deduplicates residents’ household addresses with an explicit
format marker; canonical simulation hashes and older exports retain their
meaning.
