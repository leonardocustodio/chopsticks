import { DecoratedMeta } from '@polkadot/types/metadata/decorate/types'
import { StorageKey } from '@polkadot/types'
import { stringCamelCase } from '@polkadot/util/string'

import { Blockchain } from '../blockchain'

type RawStorageValues = [string, string | null][]
type StorageConfig = Record<string, Record<string, any>>
export type StorageValues = RawStorageValues | StorageConfig

function objectToStorageItems(meta: DecoratedMeta, storage: StorageConfig): RawStorageValues {
  const storageItems: RawStorageValues = []
  for (const sectionName in storage) {
    const section = storage[sectionName]

    const pallet = meta.query[stringCamelCase(sectionName)]
    if (!pallet) throw Error(`Cannot find pallet ${sectionName}`)

    for (const storageName in section) {
      const storage = section[storageName]

      const storageEntry = pallet[stringCamelCase(storageName)]
      if (!storageEntry) throw Error(`Cannot find storage ${storageName} in pallet ${sectionName}`)

      if (storageEntry.meta.type.isPlain) {
        const key = new StorageKey(meta.registry, [storageEntry])
        storageItems.push([key.toHex(), storage ? meta.registry.createType(key.outputType, storage).toHex(true) : null])
      } else {
        for (const [keys, value] of storage) {
          const key = new StorageKey(meta.registry, [storageEntry, keys])
          storageItems.push([key.toHex(), value ? meta.registry.createType(key.outputType, value).toHex(true) : null])
        }
      }
    }
  }
  return storageItems
}

export const setStorage = async (chain: Blockchain, storage: StorageValues, blockHash?: string): Promise<string> => {
  const block = await chain.getBlock(blockHash)
  if (!block) throw Error(`Cannot find block ${blockHash || 'latest'}`)

  let storageItems: RawStorageValues
  if (Array.isArray(storage)) {
    storageItems = storage
  } else {
    storageItems = objectToStorageItems(await block.meta, storage)
  }
  block.pushStorageLayer().setAll(storageItems)
  return block.hash
}