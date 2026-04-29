"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type DraggableItem = {
  id: string;
  title: string;
  location: string | null;
};

type DraggableListProps<TItem extends DraggableItem> = {
  items: TItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onReorder: (items: TItem[]) => void;
};

export default function DraggableList<TItem extends DraggableItem>({
  items,
  selectedId,
  onSelect,
  onReorder
}: DraggableListProps<TItem>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item) => (
            <SortableItem
              key={item.id}
              id={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function SortableItem<TItem extends DraggableItem>({
  id,
  item,
  selected = false,
  onSelect
}: {
  id: string;
  item: TItem;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      className={`cursor-grab rounded-lg border bg-white p-3 transition active:cursor-grabbing ${
        selected ? "border-brand bg-blue-50" : "border-line hover:bg-slate-50"
      } ${isDragging ? "opacity-70 shadow-panel" : ""}`}
      style={style}
      onClick={() => onSelect?.(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(id);
        }
      }}
      {...attributes}
      {...listeners}
    >
      <div className="font-medium">{item.title}</div>
      <div className="text-sm text-gray-500">{item.location || "No location"}</div>
    </div>
  );
}
