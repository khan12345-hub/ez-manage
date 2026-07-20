import { useDroppable } from "@dnd-kit/core";

export function SortableGroup({
    id,
    children,
}:{
    id:string;
    children:React.ReactNode;
}) {

    const {setNodeRef}=useDroppable({
        id,
    });

    return (
        <div ref={setNodeRef}>
            {children}
        </div>
    );
}