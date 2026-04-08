import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { kenyaCounties, getTownsForCounty } from '@/lib/kenyaLocations';

type KenyaLocationFieldsProps = {
  county: string;
  town: string;
  onCountyChange: (value: string) => void;
  onTownChange: (value: string) => void;
  countyLabel?: string;
  townLabel?: string;
  countyPlaceholder?: string;
  townPlaceholder?: string;
};

export default function KenyaLocationFields({
  county,
  town,
  onCountyChange,
  onTownChange,
  countyLabel = 'County',
  townLabel = 'Town / Area',
  countyPlaceholder = 'Choose a county',
  townPlaceholder = 'Choose a town or area',
}: KenyaLocationFieldsProps) {
  const towns = getTownsForCounty(county);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>{countyLabel}</Label>
        <Select
          value={county}
          onValueChange={(value) => {
            onCountyChange(value);
            onTownChange('');
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={countyPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {kenyaCounties.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{townLabel}</Label>
        <Select value={town} onValueChange={onTownChange} disabled={!county}>
          <SelectTrigger>
            <SelectValue placeholder={county ? townPlaceholder : 'Choose county first'} />
          </SelectTrigger>
          <SelectContent>
            {towns.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
