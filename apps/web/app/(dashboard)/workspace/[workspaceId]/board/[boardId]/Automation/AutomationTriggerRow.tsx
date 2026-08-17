// "use client";

// import { Trash2 } from "lucide-react";

// import type { AutomationStep } from "./automation.types";

// import type {
//   AutomationStatusColumn,
//   AutomationTriggerType,
// } from "./automation.trigger";

// import {
//   AUTOMATION_TRIGGER_TYPES,
// } from "./automation.trigger";

// import AutomationTriggerPicker from "./AutomationTriggerPicker";
// import AutomationStatusColumnPicker from "./AutomationStatusColumnPicker";
// import AutomationStatusOptionPicker from "./AutomationStatusOptionPicker";

// type AutomationTriggerRowProps = {
//   step: AutomationStep;

//   statusColumns: AutomationStatusColumn[];

//   onUpdate: (
//     id: string,
//     key: keyof AutomationStep,
//     value: string,
//   ) => void;

//   onRemove: (
//     id: string,
//   ) => void;

//   onAdd: () => void;

//   onChangeTrigger: (
//     trigger: AutomationTriggerType,
//   ) => void;
// };

// export default function AutomationTriggerRow({
//   step,
//   statusColumns,
//   onUpdate,
//   onRemove,
//   onChangeTrigger,
// }: AutomationTriggerRowProps) {
//   const selectedColumn =
//     statusColumns.find(
//       (column) =>
//         String(column.id) ===
//         String(step.columnId),
//     );

//   return (
//     <div
//       className="
//         group
//         flex
//         items-center
//         gap-2
//         text-[25px]
//         leading-[34px]
//         text-slate-700
//       "
//     >
//       <span>When</span>

//       {step.field === "status" ? (
//         <AutomationStatusColumnPicker
//           columns={statusColumns}
//           value={step.columnId}
//           placeholder="status"
//           onSelect={(columnId) => {
//             onUpdate(
//               step.id,
//               "field",
//               "status",
//             );

//             onUpdate(
//               step.id,
//               "columnId",
//               String(columnId),
//             );

//             /*
//              * Reset the selected option
//              * whenever the status column
//              * changes.
//              */
//             onUpdate(
//               step.id,
//               "value",
//               "",
//             );

//             onChangeTrigger(
//               "status",
//             );
//           }}
//         />
//       ) : (
//         <AutomationTriggerPicker
//           value={step.field}
//           onSelect={(trigger) => {
//             onUpdate(
//               step.id,
//               "field",
//               trigger,
//             );

//             onUpdate(
//               step.id,
//               "columnId",
//               "",
//             );

//             onUpdate(
//               step.id,
//               "value",
//               "",
//             );

//             onChangeTrigger(
//               trigger,
//             );
//           }}
//         />
//       )}

//       {step.field === "status" && (
//         <>
//           <span>changes to</span>

//           <AutomationStatusOptionPicker
//             options={
//               selectedColumn?.options ??
//               []
//             }
//             value={step.value}
//             disabled={!selectedColumn}
//             placeholder="something"
//             onSelect={(optionId) => {
//               onUpdate(
//                 step.id,
//                 "value",
//                 String(optionId),
//               );

//               console.log(
//                 "Selected status:",
//                 {
//                   statusColumnId:
//                     step.columnId,
//                   selectedOption:
//                     optionId,
//                 },
//               );
//             }}
//           />
//         </>
//       )}

//       <div
//         className="
//           ml-auto
//           hidden
//           items-center
//           group-hover:flex
//         "
//       >
//         <button
//           type="button"
//           onClick={() =>
//             onRemove(step.id)
//           }
//           className="
//             text-slate-500
//             transition-colors
//             hover:text-red-500
//           "
//         >
//           <Trash2 className="h-4 w-4" />
//         </button>
//       </div>
//     </div>
//   );
// }