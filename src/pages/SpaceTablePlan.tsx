import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Armchair,
  CakeSlice,
  Copy,
  Download,
  Grid3X3,
  Loader2,
  Lock,
  Unlock,
  Map as MapIcon,
  Move,
  Music4,
  Plus,
  Save,
  Sparkles,
  Square,
  Trash2,
  Users,
  Wine,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WorkspacePageSkeleton } from '@/components/AppLoadingSkeletons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getMyWeddingOwnershipSummaryFromTables } from '@/lib/weddingWorkspace';
import { supabase } from '@/integrations/supabase/client';

type SpacePlanStatus = 'draft' | 'review' | 'final';
type SpaceObjectType =
  | 'round_table'
  | 'rectangular_table'
  | 'high_table'
  | 'sweetheart_table'
  | 'stage'
  | 'dance_floor'
  | 'cake_table'
  | 'buffet_station'
  | 'bar'
  | 'dj_booth'
  | 'photo_booth'
  | 'entrance'
  | 'aisle'
  | 'decor_zone'
  | 'vip_zone'
  | 'reserved_zone'
  | 'walkway'
  | 'power_point'
  | 'vendor_station';
type TableShape = 'round' | 'rectangle' | 'high_table' | 'sweetheart';
type SeatingPreset = 'banquet' | 'classroom' | 'boardroom' | 'ceremony_rows' | 'sweetheart';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';
type InteractionMode = 'drag' | 'resize' | 'rotate';
type DimensionUnit = 'meters' | 'feet';

type PlanSummary = {
  id: string;
  name: string;
  space_type: string;
  event_label: string | null;
  notes: string | null;
  canvas_width: number;
  canvas_height: number;
  status: SpacePlanStatus;
};

type GuestRow = {
  id: string;
  name: string;
  group_name: string | null;
  meal_preference: string | null;
  rsvp_status: string | null;
};

type LocalAssignment = {
  id: string;
  guestId: string;
  seatLabel: string;
  notes: string;
};

type SeatSlot = {
  id: string;
  label: string;
  x: number;
  y: number;
  angle?: number;
};

type LocalTableDetails = {
  tableName: string;
  shape: TableShape;
  seatingPreset: SeatingPreset;
  capacity: number;
  vip: boolean;
  decorNotes: string;
  serviceNotes: string;
  dietaryNotes: string;
  assignments: LocalAssignment[];
};

type LocalSpaceObject = {
  id: string;
  objectType: SpaceObjectType;
  label: string;
  notes: string;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  tableDetails?: LocalTableDetails;
};

type PointerInteractionState = {
  objectId: string;
  mode: InteractionMode;
  handle?: ResizeHandle;
  startClientX: number;
  startClientY: number;
  origin: LocalSpaceObject;
};

type WeddingContext = {
  weddingId: string;
  weddingName: string;
  audienceLabel: string;
};

type VenueSpacePreset = {
  id: string;
  vendorListingId: string;
  venueName: string;
  location: string | null;
  spaceName: string;
  spaceType: string;
  widthMeters: number;
  lengthMeters: number;
  maxSeatedCapacity: number | null;
  maxStandingCapacity: number | null;
  recommendedGuestCount: number | null;
  locationNotes: string | null;
  setupNotes: string | null;
  isFeatured: boolean;
};

type AlignmentGuide = {
  orientation: 'vertical' | 'horizontal';
  position: number;
};

type CanvasPaletteItem = {
  type: SpaceObjectType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  width: number;
  height: number;
  tableShape?: TableShape;
  capacity?: number;
  toneClassName: string;
};

const paletteItems: CanvasPaletteItem[] = [
  {
    type: 'round_table',
    label: 'Round table',
    icon: Users,
    width: 120,
    height: 120,
    tableShape: 'round',
    capacity: 10,
    toneClassName: 'border-amber-300 bg-amber-100/80 text-amber-900',
  },
  {
    type: 'rectangular_table',
    label: 'Rectangular table',
    icon: Square,
    width: 160,
    height: 96,
    tableShape: 'rectangle',
    capacity: 8,
    toneClassName: 'border-orange-300 bg-orange-100/80 text-orange-900',
  },
  {
    type: 'high_table',
    label: 'High table',
    icon: Sparkles,
    width: 180,
    height: 84,
    tableShape: 'high_table',
    capacity: 6,
    toneClassName: 'border-yellow-300 bg-yellow-100/80 text-yellow-900',
  },
  {
    type: 'sweetheart_table',
    label: 'Sweetheart',
    icon: Armchair,
    width: 140,
    height: 76,
    tableShape: 'sweetheart',
    capacity: 2,
    toneClassName: 'border-rose-300 bg-rose-100/80 text-rose-900',
  },
  {
    type: 'stage',
    label: 'Stage',
    icon: MapIcon,
    width: 240,
    height: 100,
    toneClassName: 'border-stone-400 bg-stone-200/80 text-stone-900',
  },
  {
    type: 'dance_floor',
    label: 'Dance floor',
    icon: Grid3X3,
    width: 220,
    height: 220,
    toneClassName: 'border-emerald-300 bg-emerald-100/80 text-emerald-900',
  },
  {
    type: 'cake_table',
    label: 'Cake table',
    icon: CakeSlice,
    width: 120,
    height: 72,
    toneClassName: 'border-pink-300 bg-pink-100/80 text-pink-900',
  },
  {
    type: 'buffet_station',
    label: 'Buffet',
    icon: Wine,
    width: 200,
    height: 72,
    toneClassName: 'border-lime-300 bg-lime-100/80 text-lime-900',
  },
  {
    type: 'bar',
    label: 'Bar',
    icon: Wine,
    width: 160,
    height: 72,
    toneClassName: 'border-cyan-300 bg-cyan-100/80 text-cyan-900',
  },
  {
    type: 'dj_booth',
    label: 'DJ booth',
    icon: Music4,
    width: 140,
    height: 72,
    toneClassName: 'border-violet-300 bg-violet-100/80 text-violet-900',
  },
  {
    type: 'photo_booth',
    label: 'Photo booth',
    icon: Sparkles,
    width: 150,
    height: 84,
    toneClassName: 'border-fuchsia-300 bg-fuchsia-100/80 text-fuchsia-900',
  },
  {
    type: 'entrance',
    label: 'Entrance',
    icon: Move,
    width: 160,
    height: 68,
    toneClassName: 'border-sky-300 bg-sky-100/80 text-sky-900',
  },
  {
    type: 'aisle',
    label: 'Aisle',
    icon: MapIcon,
    width: 240,
    height: 64,
    toneClassName: 'border-blue-300 bg-blue-100/80 text-blue-900',
  },
  {
    type: 'decor_zone',
    label: 'Decor zone',
    icon: Sparkles,
    width: 180,
    height: 96,
    toneClassName: 'border-rose-200 bg-rose-50/90 text-rose-900',
  },
  {
    type: 'vip_zone',
    label: 'VIP zone',
    icon: Users,
    width: 210,
    height: 110,
    toneClassName: 'border-amber-400 bg-amber-50/90 text-amber-950',
  },
  {
    type: 'reserved_zone',
    label: 'Reserved zone',
    icon: AlertCircle,
    width: 190,
    height: 96,
    toneClassName: 'border-orange-300 bg-orange-50/90 text-orange-950',
  },
  {
    type: 'walkway',
    label: 'Walkway',
    icon: Move,
    width: 220,
    height: 60,
    toneClassName: 'border-stone-300 bg-stone-100/90 text-stone-900',
  },
  {
    type: 'power_point',
    label: 'Power point',
    icon: AlertTriangle,
    width: 92,
    height: 74,
    toneClassName: 'border-yellow-400 bg-yellow-50/90 text-yellow-950',
  },
  {
    type: 'vendor_station',
    label: 'Vendor station',
    icon: Wine,
    width: 170,
    height: 84,
    toneClassName: 'border-emerald-400 bg-emerald-50/90 text-emerald-950',
  },
];

const spaceTypeOptions = [
  'Reception tent',
  'Church setup',
  'Garden ceremony',
  'Ballroom',
  'Venue hall',
  'Home compound',
  'After-party space',
] as const;

const defaultCanvas = {
  width: 2400,
  height: 1400,
};

const MIN_CANVAS_WIDTH = 1400;
const MIN_CANVAS_HEIGHT = 900;
const MIN_OBJECT_SIZE = 40;
const GRID_SIZE = 20;
const ALIGNMENT_THRESHOLD = 10;
const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2];
const MIN_ZOOM = zoomLevels[0];
const MAX_ZOOM = zoomLevels[zoomLevels.length - 1];
const PIXELS_PER_METER = 40;
const CANVAS_PADDING = 280;
const FEET_PER_METER = 3.28084;

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `space-plan-${Math.random().toString(36).slice(2, 10)}`;
}

function createObjectFromPalette(item: CanvasPaletteItem, index: number): LocalSpaceObject {
  const localId = makeId();

  return {
    id: localId,
    objectType: item.type,
    label: item.label,
    notes: '',
    locked: false,
    x: 120 + (index % 3) * 48,
    y: 120 + (index % 2) * 48,
    width: item.width,
    height: item.height,
    rotation: 0,
    zIndex: index + 1,
    tableDetails: item.tableShape
        ? {
          tableName: `${item.label} ${index + 1}`,
          shape: item.tableShape,
          seatingPreset:
            item.tableShape === 'sweetheart'
              ? 'sweetheart'
              : item.tableShape === 'rectangle'
                ? 'boardroom'
                : 'banquet',
          capacity: item.capacity ?? 8,
          vip: item.type === 'high_table' || item.type === 'sweetheart_table',
          decorNotes: '',
          serviceNotes: '',
          dietaryNotes: '',
          assignments: [],
        }
      : undefined,
  };
}

function buildObjectTone(objectType: SpaceObjectType) {
  return paletteItems.find((item) => item.type === objectType)?.toneClassName ?? 'border-stone-300 bg-white text-stone-900';
}

function getMinimumCanvasSize(width?: number | null, height?: number | null) {
  return {
    width: Math.max(MIN_CANVAS_WIDTH, Number(width ?? defaultCanvas.width) || defaultCanvas.width),
    height: Math.max(MIN_CANVAS_HEIGHT, Number(height ?? defaultCanvas.height) || defaultCanvas.height),
  };
}

function buildVenuePresetLabel(space: VenueSpacePreset) {
  return `${space.venueName} - ${space.spaceName}`;
}

function buildVenuePresetCanvasSize(space: VenueSpacePreset) {
  return getMinimumCanvasSize(
    Math.round(space.widthMeters * PIXELS_PER_METER + CANVAS_PADDING),
    Math.round(space.lengthMeters * PIXELS_PER_METER + CANVAS_PADDING),
  );
}

function pixelsToMeters(value: number) {
  return Math.max(0, (value - CANVAS_PADDING) / PIXELS_PER_METER);
}

function pixelsToDimension(value: number, unit: DimensionUnit) {
  const meters = pixelsToMeters(value);
  return unit === 'feet' ? meters * FEET_PER_METER : meters;
}

function dimensionToPixels(value: number, unit: DimensionUnit) {
  const meters = unit === 'feet' ? value / FEET_PER_METER : value;
  return Math.round(meters * PIXELS_PER_METER + CANVAS_PADDING);
}

function formatDimension(value: number, unit: DimensionUnit) {
  const dimension = pixelsToDimension(value, unit);
  return Number.isFinite(dimension) ? Number(dimension.toFixed(1)) : 0;
}

function formatPaletteDimension(value: number) {
  return `${(value / PIXELS_PER_METER).toFixed(1)}m`;
}

function buildSeatSlots(object: LocalSpaceObject & { tableDetails: LocalTableDetails }): SeatSlot[] {
  const capacity = Math.max(1, object.tableDetails.capacity);
  const centerX = object.width / 2;
  const centerY = object.height / 2;
  const seatingPreset = object.tableDetails.seatingPreset;

  if (object.tableDetails.shape === 'round' || object.tableDetails.shape === 'high_table') {
    const radiusX = object.width / 2 + 18;
    const radiusY = object.height / 2 + 18;
    return Array.from({ length: capacity }).map((_, index) => {
      const angle = (-Math.PI / 2) + (index * Math.PI * 2) / capacity;
      return {
        id: `seat-${index + 1}`,
        label: `Seat ${index + 1}`,
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY,
        angle,
      };
    });
  }

  if (object.tableDetails.shape === 'sweetheart' || seatingPreset === 'sweetheart') {
    return Array.from({ length: capacity }).map((_, index) => {
      const offset = capacity === 1 ? 0 : (index / (capacity - 1) - 0.5) * Math.max(object.width - 38, 26);
      return {
        id: `seat-${index + 1}`,
        label: index === 0 ? 'Partner 1' : index === 1 ? 'Partner 2' : `Seat ${index + 1}`,
        x: centerX + offset,
        y: object.height + 18,
      };
    });
  }

  if (seatingPreset === 'classroom') {
    return Array.from({ length: capacity }).map((_, index) => {
      const x = ((index + 1) / (capacity + 1)) * object.width;
      return {
        id: `seat-front-${index + 1}`,
        label: `Front ${index + 1}`,
        x,
        y: object.height + 18,
      };
    });
  }

  if (seatingPreset === 'ceremony_rows') {
    const rows = Math.max(1, Math.ceil(capacity / 2));
    const leftX = object.width * 0.28;
    const rightX = object.width * 0.72;
    return Array.from({ length: capacity }).map((_, index) => {
      const row = Math.floor(index / 2);
      const y = ((row + 1) / (rows + 1)) * object.height;
      const isLeft = index % 2 === 0;
      return {
        id: `seat-row-${index + 1}`,
        label: `Row ${row + 1}${isLeft ? 'L' : 'R'}`,
        x: isLeft ? leftX : rightX,
        y,
      };
    });
  }

  if (seatingPreset === 'boardroom') {
    const longSideCount = Math.max(1, Math.ceil((capacity - 2) / 2));
    const shortSideCount = Math.max(capacity - longSideCount * 2, 0);
    const slots: SeatSlot[] = [];
    const distribute = (count: number, axisLength: number) =>
      Array.from({ length: count }).map((_, index) => ((index + 1) / (count + 1)) * axisLength);

    distribute(longSideCount, object.height).forEach((y, index) => {
      slots.push({ id: `seat-left-${index + 1}`, label: `Left ${index + 1}`, x: -18, y });
    });
    distribute(longSideCount, object.height).forEach((y, index) => {
      slots.push({ id: `seat-right-${index + 1}`, label: `Right ${index + 1}`, x: object.width + 18, y });
    });
    distribute(shortSideCount, object.width).forEach((x, index) => {
      const isTop = index % 2 === 0;
      slots.push({
        id: `seat-end-${index + 1}`,
        label: `${isTop ? 'Top' : 'Bottom'} ${Math.floor(index / 2) + 1}`,
        x,
        y: isTop ? -18 : object.height + 18,
      });
    });
    return slots.slice(0, capacity);
  }

  const topCount = Math.ceil(capacity / 4);
  const rightCount = Math.ceil((capacity - topCount) / 3);
  const bottomCount = Math.ceil((capacity - topCount - rightCount) / 2);
  const leftCount = Math.max(capacity - topCount - rightCount - bottomCount, 0);
  const slots: SeatSlot[] = [];

  const distribute = (count: number, axisLength: number) =>
    Array.from({ length: count }).map((_, index) => ((index + 1) / (count + 1)) * axisLength);

  distribute(topCount, object.width).forEach((x, index) => {
    slots.push({ id: `seat-top-${index + 1}`, label: `Top ${index + 1}`, x, y: -18 });
  });
  distribute(rightCount, object.height).forEach((y, index) => {
    slots.push({ id: `seat-right-${index + 1}`, label: `Right ${index + 1}`, x: object.width + 18, y });
  });
  distribute(bottomCount, object.width).forEach((x, index) => {
    slots.push({ id: `seat-bottom-${index + 1}`, label: `Bottom ${index + 1}`, x, y: object.height + 18 });
  });
  distribute(leftCount, object.height).forEach((y, index) => {
    slots.push({ id: `seat-left-${index + 1}`, label: `Left ${index + 1}`, x: -18, y });
  });

  return slots.slice(0, capacity);
}

function getShapeClasses(object: LocalSpaceObject) {
  if (isTableObject(object)) {
    if (object.tableDetails.shape === 'round' || object.tableDetails.shape === 'high_table') return 'rounded-full';
    if (object.tableDetails.shape === 'sweetheart') return 'rounded-[32px_32px_18px_18px]';
    return 'rounded-[24px]';
  }

  if (object.objectType === 'walkway') return 'rounded-full border-dashed';
  if (object.objectType === 'aisle') return 'rounded-[999px]';
  if (object.objectType === 'dance_floor') return 'rounded-[20px]';
  if (object.objectType === 'entrance') return 'rounded-[26px]';
  return 'rounded-[28px]';
}

function getObjectInnerAccent(object: LocalSpaceObject) {
  if (object.objectType === 'walkway') {
    return <div className="pointer-events-none absolute inset-[10px] rounded-full border border-dashed border-stone-400/70" />;
  }

  if (object.objectType === 'aisle') {
    return (
      <>
        <div className="pointer-events-none absolute inset-y-[10px] left-[14px] w-px bg-blue-300/70" />
        <div className="pointer-events-none absolute inset-y-[10px] right-[14px] w-px bg-blue-300/70" />
        <div className="pointer-events-none absolute left-[22px] right-[22px] top-1/2 h-px -translate-y-1/2 bg-blue-300/70" />
      </>
    );
  }

  if (object.objectType === 'dance_floor') {
    return (
      <div
        className="pointer-events-none absolute inset-[12px] rounded-[16px] border border-emerald-300/70 opacity-80"
        style={{
          backgroundImage:
            'linear-gradient(rgba(16,185,129,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.18) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
    );
  }

  if (object.objectType === 'stage') {
    return <div className="pointer-events-none absolute inset-x-[18px] bottom-[12px] h-2 rounded-full bg-stone-500/25" />;
  }

  if (object.objectType === 'entrance') {
    return <div className="pointer-events-none absolute inset-x-[18px] top-[8px] h-2 rounded-full bg-sky-400/35" />;
  }

  return null;
}

function normalizeObjectOrder(objects: LocalSpaceObject[]) {
  return [...objects]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((object, index) => ({ ...object, zIndex: index + 1 }));
}

function snapValue(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function getObjectGuidePoints(object: LocalSpaceObject) {
  return {
    left: object.x,
    centerX: object.x + object.width / 2,
    right: object.x + object.width,
    top: object.y,
    centerY: object.y + object.height / 2,
    bottom: object.y + object.height,
  };
}

function clampObjectToCanvas(
  object: LocalSpaceObject,
  canvas: { width: number; height: number },
) {
  const width = Math.max(MIN_OBJECT_SIZE, object.width);
  const height = Math.max(MIN_OBJECT_SIZE, object.height);

  return {
    ...object,
    width,
    height,
    x: Math.max(0, Math.min(canvas.width - width, object.x)),
    y: Math.max(0, Math.min(canvas.height - height, object.y)),
  };
}

function buildDuplicatePlacement(object: LocalSpaceObject, totalObjects: number, canvas: { width: number; height: number }): LocalSpaceObject {
  return {
    ...object,
    id: makeId(),
    label: `${object.label} copy`,
    locked: false,
    x: Math.min(canvas.width - object.width, object.x + 36),
    y: Math.min(canvas.height - object.height, object.y + 36),
    zIndex: totalObjects + 1,
    tableDetails: object.tableDetails
        ? {
          ...object.tableDetails,
          tableName: `${object.tableDetails.tableName} copy`,
          assignments: object.tableDetails.assignments.map((assignment) => ({
            ...assignment,
            id: makeId(),
          })),
        }
      : undefined,
  };
}

function isTableObject(object: LocalSpaceObject | null | undefined): object is LocalSpaceObject & { tableDetails: LocalTableDetails } {
  return Boolean(object?.tableDetails);
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SpaceTablePlan() {
  const { user, profile } = useAuth();
  const { selectedClient } = usePlanner();
  const { toast } = useToast();
  const db = supabase as any;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<PointerInteractionState | null>(null);
  const panRef = useRef<{ startClientX: number; startClientY: number; scrollLeft: number; scrollTop: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [weddingContext, setWeddingContext] = useState<WeddingContext | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [venuePresets, setVenuePresets] = useState<VenueSpacePreset[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedVenueSpaceId, setSelectedVenueSpaceId] = useState<string | null>(null);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [planName, setPlanName] = useState('Reception floor plan');
  const [spaceType, setSpaceType] = useState<(typeof spaceTypeOptions)[number]>('Reception tent');
  const [eventLabel, setEventLabel] = useState('Main reception');
  const [planStatus, setPlanStatus] = useState<SpacePlanStatus>('draft');
  const [planNotes, setPlanNotes] = useState('');
  const [canvasSize, setCanvasSize] = useState(defaultCanvas);
  const [dimensionUnit, setDimensionUnit] = useState<DimensionUnit>('meters');
  const [zoom, setZoom] = useState(0.75);
  const [objects, setObjects] = useState<LocalSpaceObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedSeatLabel, setSelectedSeatLabel] = useState<string | null>(null);
  const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
  const [panningCanvas, setPanningCanvas] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);

  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedObjectId) ?? null,
    [objects, selectedObjectId],
  );
  const renderedObjects = useMemo(() => normalizeObjectOrder(objects), [objects]);

  const guestLookup = useMemo(() => {
    return new Map(guests.map((guest) => [guest.id, guest]));
  }, [guests]);

  const selectedVenuePreset = useMemo(
    () => venuePresets.find((space) => space.id === selectedVenueSpaceId) ?? null,
    [selectedVenueSpaceId, venuePresets],
  );

  const planHealth = useMemo(() => {
    const tableObjects = objects.filter(isTableObject);
    const assignedGuestIds = new Set(
      tableObjects.flatMap((object) => object.tableDetails.assignments.map((assignment) => assignment.guestId)),
    );

    return {
      objectCount: objects.length,
      tableCount: tableObjects.length,
      vipTables: tableObjects.filter((object) => object.tableDetails.vip),
      assignedGuests: assignedGuestIds.size,
      unassignedGuests: guests.filter((guest) => !assignedGuestIds.has(guest.id)),
      overCapacityTables: tableObjects.filter(
        (object) => object.tableDetails.assignments.length > object.tableDetails.capacity,
      ),
    };
  }, [guests, objects]);

  useEffect(() => {
    if (!user || !profile) return;

    let cancelled = false;

    const loadContext = async () => {
      setLoading(true);
      setContextError(null);

      try {
        if (profile.role === 'couple') {
          const summary = await getMyWeddingOwnershipSummaryFromTables(user.id, user.email ?? null);

          if (!summary?.weddingId) {
            throw new Error('Create or join a wedding first before testing Space & Table Plan.');
          }

          if (!cancelled) {
            setWeddingContext({
              weddingId: summary.weddingId,
              weddingName: summary.weddingName,
              audienceLabel: 'Couple workspace',
            });
          }
        } else if (profile.role === 'planner') {
          if (!selectedClient?.id) {
            throw new Error('Select a planner client first so the plan knows which wedding workspace to open.');
          }

          const { data, error } = await db
            .from('planner_clients')
            .select('id, client_name, wedding_id')
            .eq('id', selectedClient.id)
            .maybeSingle();

          if (error) throw error;
          if (!data?.wedding_id) {
            throw new Error('This planner client is not linked to a wedding workspace yet.');
          }

          if (!cancelled) {
            setWeddingContext({
              weddingId: String(data.wedding_id),
              weddingName: String(data.client_name ?? 'Planner client wedding'),
              audienceLabel: 'Planner workspace',
            });
          }
        } else {
          throw new Error('Space & Table Plan is currently available for couple and planner workspaces only.');
        }
      } catch (error: any) {
        if (!cancelled) {
          setWeddingContext(null);
          setContextError(error?.message || 'Could not load a wedding workspace for Space & Table Plan.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [db, profile, selectedClient?.id, selectedClient?.client_name, user, user?.email]);

  useEffect(() => {
    if (!weddingContext?.weddingId) return;

    let cancelled = false;

    const loadWorkspaceData = async () => {
      setLoadingPlan(true);

      try {
        const [planRes, guestRes, venueSpaceRes] = await Promise.all([
          db
            .from('wedding_space_plans')
            .select('id, name, space_type, event_label, notes, canvas_width, canvas_height, status')
            .eq('wedding_id', weddingContext.weddingId)
            .order('updated_at', { ascending: false }),
          db
            .from('guests')
            .select('id, name, group_name, meal_preference, rsvp_status')
            .eq('wedding_id', weddingContext.weddingId)
            .order('name'),
          db
            .from('vendor_listing_spaces')
            .select(`
              id,
              vendor_listing_id,
              space_name,
              space_type,
              width_meters,
              length_meters,
              max_seated_capacity,
              max_standing_capacity,
              recommended_guest_count,
              location_notes,
              setup_notes,
              is_featured,
              vendor_listings (
                business_name,
                location
              )
            `)
            .eq('is_active', true)
            .order('is_featured', { ascending: false })
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true }),
        ]);

        if (planRes.error) throw planRes.error;
        if (guestRes.error) throw guestRes.error;
        if (venueSpaceRes.error) throw venueSpaceRes.error;

        if (cancelled) return;

        const nextPlans = ((planRes.data as PlanSummary[] | null) ?? []).map((plan) => ({
          ...plan,
          canvas_width: Number(plan.canvas_width ?? defaultCanvas.width),
          canvas_height: Number(plan.canvas_height ?? defaultCanvas.height),
        }));

        setPlans(nextPlans);
        setGuests((guestRes.data as GuestRow[] | null) ?? []);
        setVenuePresets(
          (((venueSpaceRes.data as any[] | null) ?? [])).map((space) => ({
            id: String(space.id),
            vendorListingId: String(space.vendor_listing_id),
            venueName: String(space.vendor_listings?.business_name ?? 'Venue'),
            location: space.vendor_listings?.location ? String(space.vendor_listings.location) : null,
            spaceName: String(space.space_name ?? 'Venue space'),
            spaceType: String(space.space_type ?? 'Reception hall'),
            widthMeters: Number(space.width_meters ?? 0),
            lengthMeters: Number(space.length_meters ?? 0),
            maxSeatedCapacity: space.max_seated_capacity != null ? Number(space.max_seated_capacity) : null,
            maxStandingCapacity: space.max_standing_capacity != null ? Number(space.max_standing_capacity) : null,
            recommendedGuestCount: space.recommended_guest_count != null ? Number(space.recommended_guest_count) : null,
            locationNotes: space.location_notes ? String(space.location_notes) : null,
            setupNotes: space.setup_notes ? String(space.setup_notes) : null,
            isFeatured: Boolean(space.is_featured),
          })),
        );

        if (nextPlans[0]) {
          setSelectedPlanId((current) => current ?? nextPlans[0].id);
        } else {
          setSelectedPlanId(null);
          setSelectedVenueSpaceId(null);
          setObjects([]);
        }
      } catch (error: any) {
        if (!cancelled) {
          toast({
            title: 'Could not load space plans',
            description: error?.message || 'There was a problem loading this wedding layout workspace.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingPlan(false);
        }
      }
    };

    void loadWorkspaceData();

    return () => {
      cancelled = true;
    };
  }, [db, toast, weddingContext?.weddingId]);

  useEffect(() => {
    if (!selectedPlanId) return;

    let cancelled = false;

    const loadPlan = async () => {
      setLoadingPlan(true);

      try {
        const { data: planRow, error: planError } = await db
          .from('wedding_space_plans')
          .select('id, name, space_type, event_label, notes, canvas_width, canvas_height, status, venue_listing_id, venue_space_id')
          .eq('id', selectedPlanId)
          .maybeSingle();

        if (planError) throw planError;
        if (!planRow) return;

        const { data: objectRows, error: objectError } = await db
          .from('wedding_space_plan_objects')
          .select('*')
          .eq('space_plan_id', selectedPlanId)
          .order('z_index', { ascending: true })
          .order('created_at', { ascending: true });

        if (objectError) throw objectError;

        const objectIds = ((objectRows as Array<{ id: string }> | null) ?? []).map((row) => row.id);
        const { data: tableRows, error: tableError } = objectIds.length
          ? await db
              .from('wedding_space_plan_tables')
              .select('*')
              .in('space_plan_object_id', objectIds)
          : { data: [], error: null };

        if (tableError) throw tableError;

        const tableIds = ((tableRows as Array<{ id: string }> | null) ?? []).map((row) => row.id);
        const { data: assignmentRows, error: assignmentError } = tableIds.length
          ? await db
              .from('wedding_space_plan_guest_assignments')
              .select('*')
              .in('space_plan_table_id', tableIds)
          : { data: [], error: null };

        if (assignmentError) throw assignmentError;
        if (cancelled) return;

        setPlanName(String(planRow.name ?? 'Reception floor plan'));
        setSpaceType((planRow.space_type as (typeof spaceTypeOptions)[number]) ?? 'Reception tent');
        setEventLabel(String(planRow.event_label ?? ''));
        setPlanNotes(String(planRow.notes ?? ''));
        setPlanStatus((planRow.status as SpacePlanStatus) ?? 'draft');
        setCanvasSize(getMinimumCanvasSize(planRow.canvas_width, planRow.canvas_height));
        setSelectedVenueSpaceId(planRow.venue_space_id ? String(planRow.venue_space_id) : null);

        const tablesByObjectId = new Map<string, any>();
        for (const table of (tableRows as any[] | null) ?? []) {
          tablesByObjectId.set(String(table.space_plan_object_id), table);
        }

        const assignmentsByTableId = new Map<string, LocalAssignment[]>();
        for (const assignment of (assignmentRows as any[] | null) ?? []) {
          const normalized: LocalAssignment = {
            id: String(assignment.id),
            guestId: String(assignment.guest_id),
            seatLabel: String(assignment.seat_label ?? ''),
            notes: String(assignment.notes ?? ''),
          };

          const collection = assignmentsByTableId.get(String(assignment.space_plan_table_id)) ?? [];
          collection.push(normalized);
          assignmentsByTableId.set(String(assignment.space_plan_table_id), collection);
        }

        const nextObjects: LocalSpaceObject[] = ((objectRows as any[] | null) ?? []).map((row) => {
          const table = tablesByObjectId.get(String(row.id));
          const metadata = (row.metadata ?? {}) as Record<string, any>;

          return {
            id: String(row.id),
            objectType: row.object_type as SpaceObjectType,
            label: String(row.label ?? row.object_type),
            notes: String(row.notes ?? ''),
            locked: Boolean(metadata.locked),
            x: Number(row.x ?? 0),
            y: Number(row.y ?? 0),
            width: Number(row.width ?? 120),
            height: Number(row.height ?? 120),
            rotation: Number(row.rotation ?? 0),
            zIndex: Number(row.z_index ?? 0),
            tableDetails: table
              ? {
                  tableName: String(table.table_name ?? 'Table'),
                  shape: table.shape as TableShape,
                  seatingPreset: (metadata.seatingPreset as SeatingPreset | undefined)
                    ?? ((table.shape as TableShape) === 'sweetheart'
                      ? 'sweetheart'
                      : (table.shape as TableShape) === 'rectangle'
                        ? 'boardroom'
                        : 'banquet'),
                  capacity: Number(table.capacity ?? 8),
                  vip: Boolean(table.vip),
                  decorNotes: String(table.decor_notes ?? ''),
                  serviceNotes: String(table.service_notes ?? ''),
                  dietaryNotes: String(table.dietary_notes ?? ''),
                  assignments: assignmentsByTableId.get(String(table.id)) ?? [],
                }
              : undefined,
          };
        });

        setObjects(nextObjects);
        setSelectedObjectId(nextObjects[0]?.id ?? null);
        setSelectedSeatLabel(null);
      } catch (error: any) {
        if (!cancelled) {
          toast({
            title: 'Could not open this layout',
            description: error?.message || 'There was a problem loading the selected plan.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingPlan(false);
        }
      }
    };

    void loadPlan();

    return () => {
      cancelled = true;
    };
  }, [db, selectedPlanId, toast]);

  const handleAddObject = (paletteItem: CanvasPaletteItem) => {
    setObjects((current) => {
      const nextObject = createObjectFromPalette(paletteItem, current.length);
      return [...current, nextObject];
    });
  };

  const beginInteraction = (
    event: React.PointerEvent<HTMLElement>,
    objectId: string,
    mode: InteractionMode,
    handle?: ResizeHandle,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const origin = objects.find((object) => object.id === objectId);
    if (!origin) return;
    if (origin.locked) return;

    interactionRef.current = {
      objectId,
      mode,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origin,
    };
    setSelectedObjectId(objectId);
    if (mode === 'drag') setDraggingObjectId(objectId);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>, objectId: string) => {
    beginInteraction(event, objectId, 'drag');
  };

  const beginCanvasPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const target = event.target as HTMLElement;
    if (!viewport || target.closest('[data-space-object="true"], button, input, textarea, select, [role="slider"]')) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setPanningCanvas(true);
    setSelectedObjectId(null);
    setSelectedSeatLabel(null);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current && viewportRef.current) {
      const deltaX = event.clientX - panRef.current.startClientX;
      const deltaY = event.clientY - panRef.current.startClientY;
      viewportRef.current.scrollLeft = panRef.current.scrollLeft - deltaX;
      viewportRef.current.scrollTop = panRef.current.scrollTop - deltaY;
      return;
    }

    const interaction = interactionRef.current;
    if (!interaction || !canvasRef.current) return;

    const deltaX = (event.clientX - interaction.startClientX) / zoom;
    const deltaY = (event.clientY - interaction.startClientY) / zoom;
    const activeGuides: AlignmentGuide[] = [];

    setObjects((current) =>
      current.map((object) => {
        if (object.id !== interaction.objectId) return object;

        if (interaction.mode === 'drag') {
          let next = clampObjectToCanvas(
            {
              ...object,
              x: interaction.origin.x + deltaX,
              y: interaction.origin.y + deltaY,
            },
            canvasSize,
          );

          const otherObjects = current.filter((candidate) => candidate.id !== object.id);
          const nextPoints = getObjectGuidePoints(next);

          otherObjects.forEach((candidate) => {
            const candidatePoints = getObjectGuidePoints(candidate);
            (['left', 'centerX', 'right'] as const).forEach((point) => {
              const difference = candidatePoints[point] - nextPoints[point];
              if (Math.abs(difference) <= ALIGNMENT_THRESHOLD) {
                next = { ...next, x: next.x + difference };
                activeGuides.push({ orientation: 'vertical', position: candidatePoints[point] });
              }
            });
            (['top', 'centerY', 'bottom'] as const).forEach((point) => {
              const difference = candidatePoints[point] - nextPoints[point];
              if (Math.abs(difference) <= ALIGNMENT_THRESHOLD) {
                next = { ...next, y: next.y + difference };
                activeGuides.push({ orientation: 'horizontal', position: candidatePoints[point] });
              }
            });
          });

          if (snapToGrid) {
            next = {
              ...next,
              x: snapValue(next.x),
              y: snapValue(next.y),
            };
          }

          return clampObjectToCanvas(next, canvasSize);
        }

        if (interaction.mode === 'resize' && interaction.handle) {
          let nextX = interaction.origin.x;
          let nextY = interaction.origin.y;
          let nextWidth = interaction.origin.width;
          let nextHeight = interaction.origin.height;

          if (interaction.handle.includes('e')) nextWidth = interaction.origin.width + deltaX;
          if (interaction.handle.includes('s')) nextHeight = interaction.origin.height + deltaY;
          if (interaction.handle.includes('w')) {
            nextWidth = interaction.origin.width - deltaX;
            nextX = interaction.origin.x + deltaX;
          }
          if (interaction.handle.includes('n')) {
            nextHeight = interaction.origin.height - deltaY;
            nextY = interaction.origin.y + deltaY;
          }

          if (isTableObject(interaction.origin) && (interaction.origin.tableDetails.shape === 'round' || interaction.origin.tableDetails.shape === 'high_table')) {
            const uniform = Math.max(MIN_OBJECT_SIZE, Math.max(nextWidth, nextHeight));
            nextWidth = uniform;
            nextHeight = uniform;
          }

          let next = {
            ...object,
            x: nextX,
            y: nextY,
            width: nextWidth,
            height: nextHeight,
          };

          if (snapToGrid) {
            next = {
              ...next,
              x: snapValue(next.x),
              y: snapValue(next.y),
              width: snapValue(next.width),
              height: snapValue(next.height),
            };
          }

          return clampObjectToCanvas(next, canvasSize);
        }

        if (interaction.mode === 'rotate') {
          const centerX = interaction.origin.x + interaction.origin.width / 2;
          const centerY = interaction.origin.y + interaction.origin.height / 2;
          const canvasRect = canvasRef.current!.getBoundingClientRect();
          const pointerX = (event.clientX - canvasRect.left) / zoom;
          const pointerY = (event.clientY - canvasRect.top) / zoom;
          const angle = (Math.atan2(pointerY - centerY, pointerX - centerX) * 180) / Math.PI + 90;

          return {
            ...object,
            rotation: Number(angle.toFixed(1)),
          };
        }

        return object;
      }),
    );
    setAlignmentGuides(activeGuides);
  };

  const stopDragging = () => {
    setDraggingObjectId(null);
    interactionRef.current = null;
    panRef.current = null;
    setPanningCanvas(false);
    setAlignmentGuides([]);
  };

  useEffect(() => {
    if (!isTableObject(selectedObject)) {
      setSelectedSeatLabel(null);
      return;
    }

    if (selectedSeatLabel && !buildSeatSlots(selectedObject).some((seat) => seat.label === selectedSeatLabel)) {
      setSelectedSeatLabel(null);
    }
  }, [selectedObject, selectedSeatLabel]);

  const updateSelectedObject = (updater: (object: LocalSpaceObject) => LocalSpaceObject) => {
    if (!selectedObjectId) return;

    setObjects((current) =>
      current.map((object) => (object.id === selectedObjectId ? updater(object) : object)),
    );
  };

  const setZoomByDirection = (direction: 'in' | 'out') => {
    setZoom((current) => {
      const currentIndex = direction === 'in'
        ? zoomLevels.findIndex((value) => value > current + 0.001)
        : [...zoomLevels].reverse().findIndex((value) => value < current - 0.001);
      if (currentIndex === -1) return current;
      const nextIndex = direction === 'in'
        ? currentIndex
        : zoomLevels.length - 1 - currentIndex;
      return zoomLevels[nextIndex];
    });
  };

  const applyVenuePresetToCanvas = () => {
    if (!selectedVenuePreset) return;

    const nextCanvas = buildVenuePresetCanvasSize(selectedVenuePreset);
    const nextSpaceType = spaceTypeOptions.includes(selectedVenuePreset.spaceType as (typeof spaceTypeOptions)[number])
      ? (selectedVenuePreset.spaceType as (typeof spaceTypeOptions)[number])
      : 'Venue hall';
    setCanvasSize(nextCanvas);
    setSpaceType(nextSpaceType);
    setEventLabel(selectedVenuePreset.spaceName);
    setPlanNotes((current) => {
      const venueLines = [
        `Venue preset: ${buildVenuePresetLabel(selectedVenuePreset)}`,
        selectedVenuePreset.location ? `Location: ${selectedVenuePreset.location}` : null,
        selectedVenuePreset.locationNotes ? `Venue notes: ${selectedVenuePreset.locationNotes}` : null,
        selectedVenuePreset.setupNotes ? `Setup notes: ${selectedVenuePreset.setupNotes}` : null,
      ].filter(Boolean).join('\n');

      if (!venueLines) return current;
      if (current.includes(venueLines)) return current;
      return current ? `${current}\n\n${venueLines}` : venueLines;
    });
    setZoom(0.75);

    requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    });
  };

  const createFreshPlanDraft = () => {
    setSelectedPlanId(null);
    setSelectedVenueSpaceId(null);
    setPlanName('Reception floor plan');
    setSpaceType('Reception tent');
    setEventLabel('Main reception');
    setPlanStatus('draft');
    setPlanNotes('');
    setCanvasSize(defaultCanvas);
    setZoom(0.75);
    setObjects([]);
    setSelectedObjectId(null);
    setSelectedSeatLabel(null);
  };

  const deleteSelectedObject = () => {
    if (!selectedObjectId) return;

    setObjects((current) => current.filter((object) => object.id !== selectedObjectId));
    setSelectedObjectId(null);
  };

  const duplicateSelectedObject = () => {
    if (!selectedObject) return;

    setObjects((current) => [...current, buildDuplicatePlacement(selectedObject, current.length, canvasSize)]);
  };

  const moveSelectedLayer = (direction: 'forward' | 'backward') => {
    if (!selectedObjectId) return;

    setObjects((current) => {
      const ordered = normalizeObjectOrder(current);
      const index = ordered.findIndex((object) => object.id === selectedObjectId);
      if (index === -1) return current;

      const swapIndex = direction === 'forward'
        ? Math.min(ordered.length - 1, index + 1)
        : Math.max(0, index - 1);

      if (swapIndex === index) return ordered;

      const next = [...ordered];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return normalizeObjectOrder(next);
    });
  };

  const exportAssignmentsCsv = () => {
    const rows = objects
      .filter(isTableObject)
      .flatMap((object) =>
        object.tableDetails.assignments.map((assignment) => {
          const guest = guestLookup.get(assignment.guestId);

          return [
            object.tableDetails.tableName,
            guest?.name ?? 'Unknown guest',
            guest?.group_name ?? '',
            assignment.seatLabel,
            assignment.notes,
          ];
        }),
      );

    if (!rows.length) {
      toast({
        title: 'Nothing to export yet',
        description: 'Assign a few guests to tables first, then export the CSV list.',
      });
      return;
    }

    const csv = [
      ['Table', 'Guest', 'Group', 'Seat label', 'Notes'].join(','),
      ...rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')),
    ].join('\n');

    downloadCsv('zania-space-plan-table-list.csv', csv);
  };

  const openPrintLayoutView = () => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1400,height=1000');
    if (!printWindow) {
      toast({
        title: 'Could not open print view',
        description: 'Allow pop-ups for Zania, then try the print layout action again.',
        variant: 'destructive',
      });
      return;
    }

    const objectMarkup = renderedObjects.map((object) => {
      const seatSlots = isTableObject(object) ? buildSeatSlots(object) : [];
      const seatMarkup = isTableObject(object)
        ? seatSlots.map((seat) => {
            const assignment = object.tableDetails.assignments.find((item) => item.seatLabel === seat.label);
            const guest = assignment ? guestLookup.get(assignment.guestId) : null;
            return `<div class="seat" style="left:${seat.x - 12}px; top:${seat.y - 12}px;">${guest ? guest.name.slice(0, 1).toUpperCase() : ''}</div>`;
          }).join('')
        : '';
      const extraClass = isTableObject(object)
        ? object.tableDetails.shape === 'round' || object.tableDetails.shape === 'high_table'
          ? 'shape-round'
          : object.tableDetails.shape === 'sweetheart'
            ? 'shape-sweetheart'
            : 'shape-rect'
        : object.objectType === 'walkway'
          ? 'shape-walkway'
          : object.objectType === 'aisle'
            ? 'shape-aisle'
            : 'shape-rect';

      return `
        <div class="object ${extraClass}" style="left:${object.x}px; top:${object.y}px; width:${object.width}px; height:${object.height}px; transform:rotate(${object.rotation}deg); z-index:${object.zIndex};">
          <div class="label">${object.label}</div>
          ${isTableObject(object) ? `<div class="sub">${object.tableDetails.tableName}</div>` : ''}
          ${seatMarkup}
        </div>
      `;
    }).join('');

    const teamRows = renderedObjects.map((object) => {
      const seatSummary = isTableObject(object)
        ? `${object.tableDetails.assignments.length}/${object.tableDetails.capacity} assigned · ${object.tableDetails.seatingPreset.replaceAll('_', ' ')}`
        : `${Math.round(object.width)} x ${Math.round(object.height)}`;
      const notes = [
        object.notes,
        isTableObject(object) ? object.tableDetails.decorNotes : '',
        isTableObject(object) ? object.tableDetails.serviceNotes : '',
      ].filter(Boolean).join(' | ');

      return `<tr><td>${object.label}</td><td>${seatSummary}</td><td>${notes || '-'}</td></tr>`;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Zania Layout Print</title>
          <style>
            body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 24px; color: #2b2118; }
            h1, h2 { margin: 0 0 8px; }
            .meta { margin: 0 0 20px; color: #6b5a4a; }
            .canvas-shell { overflow: hidden; border: 1px solid #e7dccf; border-radius: 24px; background: #faf4ec; padding: 16px; }
            .canvas { position: relative; width: ${canvasSize.width}px; height: ${canvasSize.height}px; background-image:
              linear-gradient(rgba(115,80,50,0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(115,80,50,0.08) 1px, transparent 1px);
              background-size: 40px 40px; transform: scale(0.55); transform-origin: top left; }
            .object { position: absolute; border: 2px solid #d39a58; background: rgba(255,250,242,0.92); border-radius: 20px; box-sizing: border-box; padding: 10px; }
            .shape-round { border-radius: 999px; }
            .shape-sweetheart { border-radius: 32px 32px 18px 18px; }
            .shape-walkway { border-style: dashed; border-radius: 999px; }
            .shape-aisle { border-radius: 999px; }
            .label { font-size: 12px; font-weight: 700; }
            .sub { font-size: 10px; text-transform: uppercase; margin-top: 4px; color: #7a654f; }
            .seat { position: absolute; width: 24px; height: 24px; border-radius: 999px; background: #fff; border: 1px solid #cdb89f; font-size: 10px; display:flex; align-items:center; justify-content:center; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th, td { border: 1px solid #eadfce; padding: 10px; text-align: left; vertical-align: top; font-size: 12px; }
            th { background: #f6ece1; }
          </style>
        </head>
        <body>
          <h1>${planName}</h1>
          <p class="meta">${weddingContext?.weddingName ?? ''} · ${spaceType} · ${eventLabel || 'No event label'}${selectedVenuePreset ? ` · ${buildVenuePresetLabel(selectedVenuePreset)}` : ''}</p>
          <div class="canvas-shell">
            <div class="canvas">${objectMarkup}</div>
          </div>
          <h2>Decorator and venue notes</h2>
          <p class="meta">${planNotes || 'No overall layout notes added yet.'}</p>
          <table>
            <thead><tr><th>Zone</th><th>Readiness</th><th>Notes</th></tr></thead>
            <tbody>${teamRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const savePlan = async () => {
    if (!user?.id || !weddingContext?.weddingId) return;

    setSaving(true);

    try {
      let planId = selectedPlanId;

      if (!planId) {
        const { data, error } = await db
          .from('wedding_space_plans')
          .insert({
            wedding_id: weddingContext.weddingId,
            created_by_user_id: user.id,
            name: planName,
            space_type: spaceType,
            event_label: eventLabel || null,
            notes: planNotes || null,
            status: planStatus,
            canvas_width: canvasSize.width,
            canvas_height: canvasSize.height,
            venue_listing_id: selectedVenuePreset?.vendorListingId ?? null,
            venue_space_id: selectedVenueSpaceId,
          })
          .select('id')
          .single();

        if (error) throw error;
        planId = String(data.id);
        setSelectedPlanId(planId);
      } else {
        const { error } = await db
          .from('wedding_space_plans')
          .update({
            name: planName,
            space_type: spaceType,
            event_label: eventLabel || null,
            notes: planNotes || null,
            status: planStatus,
            canvas_width: canvasSize.width,
            canvas_height: canvasSize.height,
            venue_listing_id: selectedVenuePreset?.vendorListingId ?? null,
            venue_space_id: selectedVenueSpaceId,
          })
          .eq('id', planId);

        if (error) throw error;
      }

      const existingObjects = await db
        .from('wedding_space_plan_objects')
        .select('id')
        .eq('space_plan_id', planId);

      if (existingObjects.error) throw existingObjects.error;

      const existingObjectIds = ((existingObjects.data as Array<{ id: string }> | null) ?? []).map((row) => row.id);
      if (existingObjectIds.length) {
        const { error } = await db
          .from('wedding_space_plan_objects')
          .delete()
          .in('id', existingObjectIds);

        if (error) throw error;
      }

      const objectInsertPayload = renderedObjects.map((object, index) => ({
        id: object.id,
        space_plan_id: planId,
        object_type: object.objectType,
        label: object.label,
        notes: object.notes || null,
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        rotation: object.rotation,
        z_index: index,
        metadata: {
          locked: object.locked,
          seatingPreset: object.tableDetails?.seatingPreset ?? null,
        },
      }));

      if (objectInsertPayload.length) {
        const { error } = await db
          .from('wedding_space_plan_objects')
          .insert(objectInsertPayload);

        if (error) throw error;
      }

      const tableRows = renderedObjects.filter(isTableObject);
      const tableIdByObjectId = new Map<string, string>();
      const tableInsertPayload = tableRows.map((object) => {
        const tableId = makeId();
        tableIdByObjectId.set(object.id, tableId);

        return {
          id: tableId,
          space_plan_object_id: object.id,
          table_name: object.tableDetails.tableName,
          shape: object.tableDetails.shape,
          capacity: object.tableDetails.capacity,
          vip: object.tableDetails.vip,
          decor_notes: object.tableDetails.decorNotes || null,
          service_notes: object.tableDetails.serviceNotes || null,
          dietary_notes: object.tableDetails.dietaryNotes || null,
        };
      });

      if (tableInsertPayload.length) {
        const { error } = await db
          .from('wedding_space_plan_tables')
          .insert(tableInsertPayload);

        if (error) throw error;
      }

      const assignmentInsertPayload = tableRows.flatMap((object) =>
        object.tableDetails.assignments.map((assignment) => ({
          id: assignment.id,
          space_plan_table_id: tableIdByObjectId.get(object.id),
          guest_id: assignment.guestId,
          seat_label: assignment.seatLabel || null,
          notes: assignment.notes || null,
        })),
      );

      if (assignmentInsertPayload.length) {
        const { error } = await db
          .from('wedding_space_plan_guest_assignments')
          .insert(assignmentInsertPayload);

        if (error) throw error;
      }

      const { data: refreshedPlans, error: refreshError } = await db
        .from('wedding_space_plans')
        .select('id, name, space_type, event_label, notes, canvas_width, canvas_height, status')
        .eq('wedding_id', weddingContext.weddingId)
        .order('updated_at', { ascending: false });

      if (refreshError) throw refreshError;

      setPlans((refreshedPlans as PlanSummary[] | null) ?? []);

      toast({
        title: 'Plan saved',
        description: 'Your preview space layout draft is now stored in the private Zania workspace schema.',
      });
    } catch (error: any) {
      toast({
        title: 'Could not save plan',
        description: error?.message || 'There was a problem saving this layout draft.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <WorkspacePageSkeleton compact />;
  }

  if (contextError || !weddingContext) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <AlertCircle className="h-6 w-6 text-destructive" />
              Space &amp; Table Plan is not ready for this workspace
            </CardTitle>
            <CardDescription className="text-base leading-7 text-muted-foreground">
              {contextError || 'We could not find a wedding workspace to attach this preview feature to right now.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(212,118,70,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(212,187,125,0.14),transparent_28%),linear-gradient(180deg,#fcf7ef_0%,#f7efe5_52%,#f5ebdf_100%)]">
      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className="w-fit rounded-full border-primary/20 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-primary shadow-sm">
              Preview only
            </Badge>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary/75">{weddingContext.audienceLabel}</p>
              <h1 className="mt-2 font-display text-4xl text-foreground">Space &amp; Table Plan</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                Sketch the event space, place the key zones, assign guests to tables, and shape an execution-ready layout before it reaches the live Zania app.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="gap-2 bg-white/80" onClick={createFreshPlanDraft}>
              <Plus className="h-4 w-4" />
              New draft
            </Button>
            <Button variant="outline" className="gap-2 bg-white/80" onClick={exportAssignmentsCsv}>
              <Download className="h-4 w-4" />
              Export table CSV
            </Button>
            <Button variant="outline" className="gap-2 bg-white/80" onClick={openPrintLayoutView}>
              <MapIcon className="h-4 w-4" />
              Print layout
            </Button>
            <Button className="gap-2" onClick={savePlan} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save draft
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <Card className="border-white/70 bg-white/80 shadow-[0_22px_60px_rgba(67,36,20,0.08)] backdrop-blur">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="font-display text-2xl">{weddingContext.weddingName}</CardTitle>
                  <CardDescription>Plan setup and readiness at a glance.</CardDescription>
                </div>
                <div className={cn(
                  'w-fit rounded-full border px-3 py-1.5 text-xs font-medium',
                  planHealth.overCapacityTables.length > 0
                    ? 'border-destructive/20 bg-destructive/5 text-destructive'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800',
                )}>
                  {planHealth.overCapacityTables.length > 0
                    ? `${planHealth.overCapacityTables.length} capacity issue${planHealth.overCapacityTables.length === 1 ? '' : 's'}`
                    : 'Capacity healthy'}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
              <div className="space-y-2 xl:col-span-2">
                <Label>Saved plans</Label>
                <Select value={selectedPlanId ?? 'new'} onValueChange={(value) => setSelectedPlanId(value === 'new' ? null : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a saved plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New unsaved draft</SelectItem>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 xl:col-span-1">
                <Label>Status</Label>
                <Select value={planStatus} onValueChange={(value) => setPlanStatus(value as SpacePlanStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 xl:col-span-2">
                <Label>Plan name</Label>
                <Input value={planName} onChange={(event) => setPlanName(event.target.value)} />
              </div>

              <div className="space-y-2 xl:col-span-2">
                <Label>Space type</Label>
                <Select value={spaceType} onValueChange={(value) => setSpaceType(value as (typeof spaceTypeOptions)[number])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {spaceTypeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 xl:col-span-1">
                <Label>Event label</Label>
                <Input value={eventLabel} onChange={(event) => setEventLabel(event.target.value)} placeholder="Main reception" />
              </div>

              <div className="space-y-2 xl:col-span-4">
                <Label>Venue space preset</Label>
                <div className="flex flex-col gap-3 lg:flex-row">
                  <Select value={selectedVenueSpaceId ?? 'none'} onValueChange={(value) => setSelectedVenueSpaceId(value === 'none' ? null : value)}>
                    <SelectTrigger className="lg:flex-1">
                      <SelectValue placeholder="Choose a venue space preset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No venue preset</SelectItem>
                      {venuePresets.map((space) => (
                        <SelectItem key={space.id} value={space.id}>
                          {buildVenuePresetLabel(space)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={applyVenuePresetToCanvas} disabled={!selectedVenuePreset}>
                    Apply venue dimensions
                  </Button>
                </div>
                {selectedVenuePreset ? (
                  <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{buildVenuePresetLabel(selectedVenuePreset)}</p>
                    <p className="mt-1">
                      {selectedVenuePreset.widthMeters}m x {selectedVenuePreset.lengthMeters}m
                      {selectedVenuePreset.maxSeatedCapacity ? ` · seats ${selectedVenuePreset.maxSeatedCapacity}` : ''}
                      {selectedVenuePreset.maxStandingCapacity ? ` · standing ${selectedVenuePreset.maxStandingCapacity}` : ''}
                    </p>
                    {selectedVenuePreset.locationNotes ? <p className="mt-2">{selectedVenuePreset.locationNotes}</p> : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Venue vendors can publish their actual wedding spaces, then couples and planners can start from those dimensions instead of rebuilding the room from scratch.
                  </p>
                )}
              </div>

              <div className="space-y-2 xl:col-span-4">
                <Label>Plan notes</Label>
                <Textarea
                  value={planNotes}
                  onChange={(event) => setPlanNotes(event.target.value)}
                  placeholder="What should decorators, ushers, or caterers understand from this layout?"
                  className="min-h-[90px]"
                />
              </div>
              <div className="grid gap-2 md:grid-cols-4 xl:col-span-8">
                {[
                  ['Objects', planHealth.objectCount],
                  ['Tables', planHealth.tableCount],
                  ['Guests seated', planHealth.assignedGuests],
                  ['Unassigned', planHealth.unassignedGuests.length],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-primary/10 bg-primary/5 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/70">{label}</p>
                    <p className="mt-1 font-display text-2xl text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card className="overflow-hidden border-white/70 bg-white/80 shadow-[0_22px_60px_rgba(67,36,20,0.08)] backdrop-blur">
            <CardHeader className="border-b border-border/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-display text-2xl">Canvas</CardTitle>
                  <CardDescription>Drag the canvas to move around. Add objects from the tool strip below.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-full border border-border/70 bg-white/90 px-3 py-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    <Move className="h-3.5 w-3.5" />
                    Drag canvas
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-border/70 bg-white/90 px-2 py-1.5 shadow-sm">
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setZoomByDirection('out')} disabled={zoom <= MIN_ZOOM}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="min-w-14 text-center text-xs font-semibold text-foreground tabular-nums">{Math.round(zoom * 100)}%</span>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setZoomByDirection('in')} disabled={zoom >= MAX_ZOOM}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="rounded-[28px] border border-border/60 bg-white/80 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">Object palette</p>
                    <p className="text-xs text-muted-foreground">Tap an item to place it on the canvas.</p>
                  </div>
                  <Badge variant="secondary" className="rounded-full">{paletteItems.length} tools</Badge>
                </div>
                <div className="grid max-h-44 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">
                  {paletteItems.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => handleAddObject(item)}
                      className="group flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-background/90 px-3 py-2.5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5"
                    >
                      <span>
                        <span className="block text-sm font-medium text-foreground">{item.label}</span>
                        <span className="mt-0.5 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          {formatPaletteDimension(item.width)} x {formatPaletteDimension(item.height)}
                        </span>
                      </span>
                      <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:rotate-90 group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[160px_160px_140px_minmax(220px,1fr)]">
                <div className="space-y-2">
                  <Label>Width ({dimensionUnit === 'meters' ? 'm' : 'ft'})</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formatDimension(canvasSize.width, dimensionUnit)}
                    onChange={(event) =>
                      setCanvasSize((current) => ({
                        ...current,
                        width: Math.max(MIN_CANVAS_WIDTH, dimensionToPixels(Number(event.target.value) || 0, dimensionUnit)),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height ({dimensionUnit === 'meters' ? 'm' : 'ft'})</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formatDimension(canvasSize.height, dimensionUnit)}
                    onChange={(event) =>
                      setCanvasSize((current) => ({
                        ...current,
                        height: Math.max(MIN_CANVAS_HEIGHT, dimensionToPixels(Number(event.target.value) || 0, dimensionUnit)),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Units</Label>
                  <Select value={dimensionUnit} onValueChange={(value) => setDimensionUnit(value as DimensionUnit)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meters">Meters</SelectItem>
                      <SelectItem value="feet">Feet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-3xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">Room size</p>
                  <p className="mt-2 text-foreground">
                    {formatDimension(canvasSize.width, dimensionUnit)} x {formatDimension(canvasSize.height, dimensionUnit)} {dimensionUnit === 'meters' ? 'm' : 'ft'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant={snapToGrid ? 'default' : 'outline'} size="sm" onClick={() => setSnapToGrid((current) => !current)}>
                  {snapToGrid ? 'Grid snap on' : 'Grid snap off'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Click an object to edit it. Drag empty canvas space to pan.
                </p>
              </div>

              <div className="rounded-[28px] border border-border/60 bg-white/85 p-3 shadow-sm">
                {!selectedObject ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span>Select an object to edit label, size, rotation, layer, lock, and notes.</span>
                    <Badge variant="outline" className="rounded-full">Inspector</Badge>
                  </div>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-[1.2fr_0.9fr_1fr_auto]">
                    <div className="grid gap-2 sm:grid-cols-[minmax(160px,1fr)_120px]">
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Selected</Label>
                        <Input value={selectedObject.label} onChange={(event) => updateSelectedObject((object) => ({ ...object, label: event.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Rotation</Label>
                        <Input
                          type="number"
                          value={selectedObject.rotation}
                          onChange={(event) =>
                            updateSelectedObject((object) => ({
                              ...object,
                              rotation: Math.max(-180, Math.min(180, Number(event.target.value) || 0)),
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Width</Label>
                        <Input
                          type="number"
                          value={selectedObject.width}
                          onChange={(event) =>
                            updateSelectedObject((object) => ({
                              ...object,
                              width: Math.max(MIN_OBJECT_SIZE, Number(event.target.value) || MIN_OBJECT_SIZE),
                              x: Math.min(object.x, canvasSize.width - Math.max(MIN_OBJECT_SIZE, Number(event.target.value) || MIN_OBJECT_SIZE)),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Height</Label>
                        <Input
                          type="number"
                          value={selectedObject.height}
                          onChange={(event) =>
                            updateSelectedObject((object) => ({
                              ...object,
                              height: Math.max(MIN_OBJECT_SIZE, Number(event.target.value) || MIN_OBJECT_SIZE),
                              y: Math.min(object.y, canvasSize.height - Math.max(MIN_OBJECT_SIZE, Number(event.target.value) || MIN_OBJECT_SIZE)),
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Angle</Label>
                        <span className="text-xs font-semibold tabular-nums text-foreground">{selectedObject.rotation}°</span>
                      </div>
                      <Slider
                        value={[selectedObject.rotation]}
                        min={-180}
                        max={180}
                        step={1}
                        onValueChange={([value]) =>
                          updateSelectedObject((object) => ({
                            ...object,
                            rotation: value,
                          }))
                        }
                        aria-label="Object rotation"
                      />
                    </div>

                    <div className="flex flex-wrap items-end gap-2 xl:justify-end">
                      <Button
                        type="button"
                        variant={selectedObject.locked ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateSelectedObject((object) => ({ ...object, locked: !object.locked }))}
                      >
                        {selectedObject.locked ? <Lock className="mr-2 h-4 w-4" /> : <Unlock className="mr-2 h-4 w-4" />}
                        {selectedObject.locked ? 'Locked' : 'Unlocked'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => moveSelectedLayer('backward')}>
                        Back
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => moveSelectedLayer('forward')}>
                        Front
                      </Button>
                      <Button variant="outline" size="icon" onClick={duplicateSelectedObject} aria-label="Duplicate selected object">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={deleteSelectedObject} aria-label="Delete selected object">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-1 xl:col-span-4">
                      <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Notes</Label>
                      <Input
                        value={selectedObject.notes}
                        onChange={(event) => updateSelectedObject((object) => ({ ...object, notes: event.target.value }))}
                        placeholder="Setup note for decorators, ushers, or vendors"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="absolute right-4 top-4 z-20 w-48 rounded-2xl border border-border/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Zoom</Label>
                    <span className="text-xs font-semibold tabular-nums text-foreground">{Math.round(zoom * 100)}%</span>
                  </div>
                  <Slider
                    value={[zoom]}
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={0.05}
                    onValueChange={([value]) => setZoom(Number(value.toFixed(2)))}
                    aria-label="Canvas zoom"
                  />
                </div>

              <div
                ref={viewportRef}
                className={cn(
                  'min-h-[72vh] overflow-auto rounded-[32px] border border-border/60 bg-[#faf4ec] shadow-inner transition-colors duration-300',
                  panningCanvas ? 'ring-2 ring-primary/20' : '',
                )}
              >
                <div
                  className="transition-[width,height] duration-200 ease-out"
                  style={{
                    width: canvasSize.width * zoom,
                    height: canvasSize.height * zoom,
                  }}
                >
                  <div
                    ref={canvasRef}
                    className={cn(
                      'relative origin-top-left overflow-hidden bg-[linear-gradient(rgba(115,80,50,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(115,80,50,0.08)_1px,transparent_1px)] bg-[size:40px_40px] transition-transform duration-200 ease-out',
                      panningCanvas ? 'cursor-grabbing' : 'cursor-grab',
                    )}
                    style={{
                      width: canvasSize.width,
                      height: canvasSize.height,
                      transform: `scale(${zoom})`,
                      transformOrigin: 'top left',
                    }}
                    onPointerDown={beginCanvasPan}
                    onPointerMove={handlePointerMove}
                    onPointerUp={stopDragging}
                    onPointerLeave={stopDragging}
                  >
                    {loadingPlan ? (
                      <div className="absolute inset-0 bg-white/75 p-6 backdrop-blur-sm">
                        <div className="grid h-full gap-4 md:grid-cols-[1.2fr_0.8fr]">
                          <div className="rounded-[28px] border border-border/60 bg-white/80 p-5">
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="mt-3 h-4 w-56" />
                            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                              {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="rounded-2xl border border-border/50 bg-background/75 p-4">
                                  <Skeleton className="h-4 w-28" />
                                  <Skeleton className="mt-4 h-24 w-full rounded-2xl" />
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-[28px] border border-border/60 bg-white/80 p-5">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="mt-3 h-10 w-full rounded-2xl" />
                            <Skeleton className="mt-4 h-10 w-full rounded-2xl" />
                            <Skeleton className="mt-4 h-32 w-full rounded-[24px]" />
                          </div>
                        </div>
                      </div>
                    ) : null}

                  {objects.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="max-w-md rounded-[28px] border border-dashed border-primary/25 bg-white/85 px-8 py-8 text-center shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Blank canvas</p>
                        <h3 className="mt-3 font-display text-3xl text-foreground">Start with the room essentials</h3>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          Add tables, stage, dance floor, buffet, and the key guest-flow zones first. We only need the strongest planning moves in this preview.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {renderedObjects.map((object) => {
                    const seatSlots = isTableObject(object) ? buildSeatSlots(object) : [];

                    return (
                      <div
                        key={object.id}
                        data-space-object="true"
                        role="button"
                        tabIndex={0}
                        onPointerDown={(event) => handlePointerDown(event, object.id)}
                        onClick={() => {
                          setSelectedObjectId(object.id);
                          setSelectedSeatLabel(null);
                        }}
                        className={cn(
                          'absolute border-2 px-4 py-3 text-left shadow-[0_18px_40px_rgba(67,36,20,0.12)] transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out focus:outline-none',
                          getShapeClasses(object),
                          buildObjectTone(object.objectType),
                          selectedObjectId === object.id ? 'ring-2 ring-primary/40' : 'opacity-95 hover:opacity-100',
                          object.locked ? 'cursor-default' : draggingObjectId === object.id ? 'cursor-grabbing duration-75' : 'cursor-grab',
                        )}
                        style={{
                          left: object.x,
                          top: object.y,
                          width: object.width,
                          height: object.height,
                          transform: `rotate(${object.rotation}deg)`,
                          zIndex: object.zIndex,
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedObjectId(object.id);
                            setSelectedSeatLabel(null);
                          }
                        }}
                      >
                        {getObjectInnerAccent(object)}
                        {selectedObjectId === object.id && !object.locked ? (
                          <>
                            {([
                              ['nw', 'left-0 top-0'],
                              ['ne', 'right-0 top-0'],
                              ['sw', 'bottom-0 left-0'],
                              ['se', 'bottom-0 right-0'],
                            ] as Array<[ResizeHandle, string]>).map(([handle, position]) => (
                              <button
                                key={handle}
                                type="button"
                                className={cn('absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-white shadow-sm', position)}
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                  beginInteraction(event, object.id, 'resize', handle);
                                }}
                                aria-label={`Resize ${handle}`}
                              />
                            ))}
                            <button
                              type="button"
                              className="absolute left-1/2 top-0 h-6 w-6 -translate-x-1/2 -translate-y-[150%] rounded-full border-2 border-primary bg-white shadow-sm transition hover:scale-110 hover:bg-primary hover:text-primary-foreground"
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                beginInteraction(event, object.id, 'rotate');
                              }}
                              aria-label="Rotate object"
                            >
                              <div className="mx-auto h-1.5 w-1.5 rounded-full bg-primary" />
                            </button>
                          </>
                        ) : null}
                        {isTableObject(object)
                          ? seatSlots.map((seat) => {
                              const assignment = object.tableDetails.assignments.find((item) => item.seatLabel === seat.label);
                              const guest = assignment ? guestLookup.get(assignment.guestId) : null;
                              return (
                                <button
                                  key={seat.id}
                                  type="button"
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedObjectId(object.id);
                                    setSelectedSeatLabel(seat.label);
                                  }}
                                  className={cn(
                                    'absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border text-[10px] font-semibold shadow-sm transition',
                                    assignment
                                      ? 'border-emerald-400 bg-emerald-100 text-emerald-950'
                                      : 'border-white/90 bg-white/90 text-stone-600',
                                    selectedObjectId === object.id && selectedSeatLabel === seat.label ? 'ring-2 ring-primary/40' : '',
                                  )}
                                  style={{ left: seat.x, top: seat.y }}
                                  title={guest ? `${seat.label}: ${guest.name}` : `${seat.label}: Unassigned`}
                                >
                                  {guest ? guest.name.slice(0, 1).toUpperCase() : seat.label.replace(/[^0-9]/g, '').slice(-2) || 'S'}
                                </button>
                              );
                            })
                          : null}

                        <div className="relative flex h-full flex-col justify-between">
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-sm font-semibold">{object.label}</p>
                            <div className="flex items-center gap-1">
                              {object.locked ? (
                                <Badge variant="secondary" className="rounded-full bg-white/80 text-[10px] uppercase tracking-[0.16em] text-stone-700">
                                  Locked
                                </Badge>
                              ) : null}
                              {isTableObject(object) ? (
                                <Badge variant="secondary" className="rounded-full bg-white/70 text-[10px] uppercase tracking-[0.16em] text-stone-700">
                                  {object.tableDetails.assignments.length}/{object.tableDetails.capacity}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          {isTableObject(object) ? (
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-stone-700/80">
                                {object.tableDetails.tableName}
                              </p>
                              {object.tableDetails.vip ? (
                                <Badge variant="secondary" className="w-fit rounded-full bg-white/70 text-[9px] uppercase tracking-[0.18em] text-stone-700">
                                  VIP
                                </Badge>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-700/70">
                              {object.width} x {object.height}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {alignmentGuides.map((guide, index) => (
                    <div
                      key={`${guide.orientation}-${guide.position}-${index}`}
                      className="pointer-events-none absolute bg-primary/45"
                      style={
                        guide.orientation === 'vertical'
                          ? { left: guide.position, top: 0, width: 1, height: canvasSize.height, zIndex: 999 }
                          : { top: guide.position, left: 0, height: 1, width: canvasSize.width, zIndex: 999 }
                      }
                    />
                  ))}
                </div>
              </div>
              </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
