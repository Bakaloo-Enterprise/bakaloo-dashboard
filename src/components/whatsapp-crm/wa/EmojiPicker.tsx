"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const GROUPS: Array<{ id: string; icon: string; label: string; emoji: string }> = [
  { id: "smileys", icon: "😀", label: "Smileys", emoji: "😀😃😄😁😆😅😂🤣😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🥳😏😒😞😔😟😕🙁😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🤥😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕" },
  { id: "people", icon: "👍", label: "People", emoji: "👋🤚🖐✋🖖👌🤏✌🤞🤟🤘🤙👈👉👆👇☝👍👎✊👊🤛🤜👏🙌👐🤲🤝🙏💪🦾🙋‍♂️🙋‍♀️🤷‍♂️🤷‍♀️🤦‍♂️🤦‍♀️💁‍♂️💁‍♀️👨‍🍳👩‍🍳🛵🧑‍💼" },
  { id: "food", icon: "🍎", label: "Food", emoji: "🍎🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🍆🥑🥦🥬🥒🌶🌽🥕🧄🧅🥔🍠🥐🍞🥖🧀🥚🍳🥞🧇🥓🥩🍗🍖🌭🍔🍟🍕🥪🌮🌯🍚🍛🍜🍝🍣🍤🥛☕🍵🧃🥤🍫🍬🍭🍪🎂🍰" },
  { id: "objects", icon: "🛒", label: "Shop", emoji: "🛒🛍🧺📦🚚🛵🏪🏠💰💵💳🧾🏷📍📞📱⏰📅✅❌⚠️❗❓💯🔥⭐🌟✨🎉🎁🎊🔔📢💬📝📌🔒🔑" },
  { id: "hearts", icon: "❤️", label: "Hearts", emoji: "❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝" },
]

const split = (s: string) => Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment)

/** Small emoji panel (no external service): five groups, click to insert at the cursor. */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [group, setGroup] = useState(GROUPS[0].id)
  const g = GROUPS.find((x) => x.id === group) ?? GROUPS[0]
  return (
    <div className="w-[320px] overflow-hidden rounded-xl border border-[var(--wa-border)] bg-[var(--wa-panel)] shadow-xl" role="dialog" aria-label="Emoji">
      <div className="flex border-b border-[var(--wa-border)] bg-[var(--wa-panel-header)]">
        {GROUPS.map((x) => (
          <button
            key={x.id}
            type="button"
            title={x.label}
            aria-label={x.label}
            onClick={() => setGroup(x.id)}
            className={cn("flex-1 py-2 text-lg transition-colors hover:bg-black/5", group === x.id && "border-b-2 border-[var(--wa-green)]")}
          >
            {x.icon}
          </button>
        ))}
      </div>
      <div className="wa-scroll grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {split(g.emoji).map((e, i) => (
          <button key={`${e}-${i}`} type="button" onClick={() => onPick(e)} className="flex h-9 w-9 items-center justify-center rounded-md text-xl hover:bg-black/5 dark:hover:bg-white/10" aria-label={`Insert ${e}`}>
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
