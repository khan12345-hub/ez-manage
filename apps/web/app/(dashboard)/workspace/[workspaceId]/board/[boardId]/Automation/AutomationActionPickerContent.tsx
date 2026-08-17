// "use client";

// import { Search } from "lucide-react";

// import { PopoverContent } from "@/components/ui/popover";

// import type {
//   AutomationAction,
//   AutomationActionType,
// } from "./automation.actions";

// import AutomationActionSection from "./AutomationActionSection";

// type AutomationActionPickerContentProps = {
//   search: string;

//   setSearch: (value: string) => void;

//   mostUsed: readonly AutomationAction[];

//   featured: readonly AutomationAction[];

//   onSelect: (action: AutomationActionType) => void;
// };

// export default function AutomationActionPickerContent({
//   search,
//   setSearch,
//   mostUsed,
//   featured,
//   onSelect,
// }: AutomationActionPickerContentProps) {
//   const hasActions =
//     mostUsed.length > 0 || featured.length > 0;

//   return (
//     <PopoverContent
//       align="start"
//       side="bottom"
//       sideOffset={8}
//       className="
//         w-[275px]
//         rounded-lg
//         border
//         bg-white
//         p-2
//         shadow-xl
//       "
//     >
//       {/* Search */}
//       <div
//         className="
//           mb-2
//           flex
//           h-9
//           items-center
//           rounded-md
//           border
//           border-blue-500
//           px-2
//         "
//       >
//         <Search
//           className="
//             mr-2
//             h-4
//             w-4
//             shrink-0
//             text-slate-400
//           "
//         />

//         <input
//           autoFocus
//           value={search}
//           onChange={(event) =>
//             setSearch(event.target.value)
//           }
//           placeholder="Search"
//           className="
//             h-full
//             w-full
//             border-0
//             bg-transparent
//             text-sm
//             outline-none
//             placeholder:text-slate-400
//           "
//         />
//       </div>

//       {/* Actions */}
//       <div className="max-h-[260px] overflow-y-auto pr-1">
//         {mostUsed.length > 0 && (
//           <AutomationActionSection
//             title="Most used"
//             actions={mostUsed}
//             onSelect={onSelect}
//           />
//         )}

//         {featured.length > 0 && (
//           <AutomationActionSection
//             title="Featured"
//             actions={featured}
//             onSelect={onSelect}
//           />
//         )}

//         {!hasActions && (
//           <div
//             className="
//               px-2
//               py-6
//               text-center
//               text-sm
//               text-slate-400
//             "
//           >
//             No actions found
//           </div>
//         )}
//       </div>
//     </PopoverContent>
//   );
// }