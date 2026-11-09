import RemoteStorage from './remotestorage';
import Solid from './solid';

/** Opt-in entry point. Use instead of the default entry to enable Solid. */
export class RemoteStorageWithSolid extends RemoteStorage {
  static Solid = Solid;
  declare solid?: Solid;
}

export default RemoteStorageWithSolid;
