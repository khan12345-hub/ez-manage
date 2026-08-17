// "use client";

// import { useState } from "react";
// import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// import type { AutomationStep } from "./automation.types";
// import AutomationGallery from "./AutomationGallery";
// import AutomationBuilder  from "./AutomationBuilder";
// import { AutomationTriggerType } from "./automation.trigger";
// import { AutomationGroup } from "./AutomationGroupPicker";


// type AutomationModalProps = {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   boardName?: string;
//   columns: any;
//   groups: AutomationGroup[];
// };

// export default function AutomationModal({
//   open,
//   onOpenChange,
//   columns,
//   boardName = "Testing board 2",
//   groups
// }: AutomationModalProps) {
//   const [view, setView] = useState<"templates" | "builder">("templates");

//   const [steps, setSteps] = useState<AutomationStep[]>([
//     {
//       id: "trigger-1",
//       type: "trigger",
//       field: "",
//       value: "",
//     },
//     {
//       id: "action-1",
//       type: "action",
//       field: "",
//       value: "",
//     },
//   ]);

//   const reset = () => {
//     setView("templates");

//     setSteps([
//       {
//         id: "trigger-1",
//         type: "trigger",
//         field: "",
//         value: "",
//       },
//       {
//         id: "action-1",
//         type: "action",
//         field: "",
//         value: "",
//       },
//     ]);
//   };

//   const handleClose = () => {
//     onOpenChange(false);

//     setTimeout(() => {
//       reset();
//     }, 200);
//   };

//   const updateStep = (id: string, key: keyof AutomationStep, value: string) => {
//     setSteps((current) =>
//       current.map((step) =>
//         step.id === id
//           ? {
//               ...step,
//               [key]: value,
//             }
//           : step,
//       ),
//     );
//   };

//   const removeStep = (id: string) => {
//     setSteps((current) =>
//       current.map((step) => {
//         if (step.id !== id) {
//           return step;
//         }

//         return {
//           ...step,
//           field: "",
//           value: "",
//         };
//       }),
//     );
//   };

//   const addTrigger = () => {
//     setSteps((current) => [
//       ...current,
//       {
//         id: crypto.randomUUID(),
//         type: "trigger",
//         field: "",
//         value: "",
//       },
//     ]);
//   };

//   // const addAction = () => {
//   //   setSteps((current) => [
//   //     ...current,
//   //     {
//   //       id: crypto.randomUUID(),
//   //       type: "action",
//   //       field: "",
//   //       value: "",
//   //     },
//   //   ]);
//   // };
//   const addAction = (
//     action:
//       | "move"
//       | "notify"
//       | "change-status"
//       | "create-subitem"
//       | "set-date"
//       | "send-email"
//       | "assign",
//   ) => {
//     setSteps((current) => [
//       ...current,
//       {
//         id: crypto.randomUUID(),
//         field: action,
//         value: "",
//         type: "action",
//       },
//     ]);
//   };

//   const createFromScratch = () => {
//     setSteps([
//       {
//         id: crypto.randomUUID(),
//         type: "trigger",
//         field: "",
//         value: "",
//       },
//       {
//         id: crypto.randomUUID(),
//         type: "action",
//         field: "",
//         value: "",
//       },
//     ]);

//     setView("builder");
//   };

//   const useTemplate = (templateId: string) => {
//     switch (templateId) {
//       case "status-move":
//         setSteps([
//           {
//             id: crypto.randomUUID(),
//             type: "trigger",
//             field: "status",
//             value: "something",
//           },
//           {
//             id: crypto.randomUUID(),
//             type: "action",
//             field: "move",
//             value: "",
//           },
//         ]);
//         break;

//       case "assign-creator":
//         setSteps([
//           {
//             id: crypto.randomUUID(),
//             type: "trigger",
//             field: "item-created",
//             value: "",
//           },
//           {
//             id: crypto.randomUUID(),
//             type: "action",
//             field: "assign-creator",
//             value: "",
//           },
//         ]);
//         break;

//       case "date-notify":
//         setSteps([
//           {
//             id: crypto.randomUUID(),
//             type: "trigger",
//             field: "date",
//             value: "arrives",
//           },
//           {
//             id: crypto.randomUUID(),
//             type: "action",
//             field: "notify",
//             value: "",
//           },
//         ]);
//         break;
//     }

//     setView("builder");
//   };
//   const handleChangeTrigger = (trigger: AutomationTriggerType) => {
//     setSteps((current) =>
//       current.map((step) =>
//         step.type === "trigger"
//           ? {
//               ...step,
//               field: trigger,
//               value: "",
//             }
//           : step,
//       ),
//     );
//   };

//   return (
//     <Dialog
//       open={open}
//       onOpenChange={(value) => {
//         if (!value) {
//           handleClose();
//         } else {
//           onOpenChange(value);
//         }
//       }}
//     >
//       <DialogContent
//         className="
//           max-w-[calc(100vw-48px)]!
//           h-[calc(100vh-24px)]
//           p-0
//           gap-0
//           overflow-hidden
//           rounded-lg
//           border
//           bg-white
//         "
//       >
//         <DialogTitle className="sr-only">Board automations</DialogTitle>

//         {view === "templates" ? (
//           <AutomationGallery
//             boardName={boardName}
//             onClose={handleClose}
//             onCreateFromScratch={createFromScratch}
//             onUseTemplate={useTemplate}
//           />
//         ) : (
//           <AutomationBuilder
//             statusColumns={columns}
//             groups={groups}
//             boardName={boardName}
//             steps={steps}
//             onBack={() => setView("templates")}
//             onClose={handleClose}
//             onUpdateStep={updateStep}
//             onRemoveStep={removeStep}
//             onAddTrigger={addTrigger}
//             onAddAction={addAction}
//             onChangeTrigger={handleChangeTrigger}
//           />
//         )}
//       </DialogContent>
//     </Dialog>
//   );
// }
