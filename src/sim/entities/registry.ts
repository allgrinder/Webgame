import type { EntityDef } from '../../data/entities';
import type { Dir } from '../geom';
import type { EntityBase } from './base';
import { BeltEntity, ContainerEntity, DrillEntity, FurnaceEntity } from './basic';
import { InserterEntity } from './inserter';
import { AssemblerEntity, LabEntity } from './production';
import { BoilerEntity, GeneratorEntity, PipeEntity, PoleEntity, PumpEntity } from './power';

type Ctor = new (id: number, name: string, x: number, y: number, dir: Dir) => EntityBase;

/** Gebäudeart (EntityDef.kind) -> Klasse. Neue Gebäude hier eintragen. */
export const ENTITY_CLASSES: Record<EntityDef['kind'], Ctor> = {
  belt: BeltEntity,
  drill: DrillEntity,
  furnace: FurnaceEntity,
  inserter: InserterEntity,
  container: ContainerEntity,
  pipe: PipeEntity,
  'offshore-pump': PumpEntity,
  boiler: BoilerEntity,
  generator: GeneratorEntity,
  pole: PoleEntity,
  assembler: AssemblerEntity,
  lab: LabEntity,
};
