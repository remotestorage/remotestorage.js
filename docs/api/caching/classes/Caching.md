# Class: Caching

Caching

Holds/manages caching configuration.

## Methods

### checkPath()

> **checkPath**(`path`): `string`

Retrieve caching setting for a given path, or its next parent
with a caching strategy set.

#### Parameters

• **path**: `string`

Path to retrieve setting for

#### Returns

`string`

caching strategy for the path

#### Source

[caching.ts:99](https://github.com/remotestorage/remotestorage.js/blob/1966eed75e2e4c81d5410b5a500cddf1f63a1cc0/src/caching.ts#L99)

***

### disable()

> **disable**(`path`): `void`

Disable caching for a given path.

Uses caching strategy ``FLUSH`` (meaning items are only cached until
successfully pushed to the remote).

#### Parameters

• **path**: `string`

Path to disable caching for

#### Returns

`void`

#### Source

[caching.ts:74](https://github.com/remotestorage/remotestorage.js/blob/1966eed75e2e4c81d5410b5a500cddf1f63a1cc0/src/caching.ts#L74)

***

### enable()

> **enable**(`path`): `void`

Enable caching for a given path.

Uses caching strategy ``ALL``.

#### Parameters

• **path**: `string`

Path to enable caching for

#### Returns

`void`

#### Source

[caching.ts:62](https://github.com/remotestorage/remotestorage.js/blob/1966eed75e2e4c81d5410b5a500cddf1f63a1cc0/src/caching.ts#L62)

***

### onActivate()

> **onActivate**(`cb`): `void`

Set a callback for when caching is activated for a path.

#### Parameters

• **cb**

Callback function

#### Returns

`void`

#### Source

[caching.ts:83](https://github.com/remotestorage/remotestorage.js/blob/1966eed75e2e4c81d5410b5a500cddf1f63a1cc0/src/caching.ts#L83)

***

### reset()

> **reset**(): `void`

Reset the state of caching by deleting all caching information.

#### Returns

`void`

#### Source

[caching.ts:112](https://github.com/remotestorage/remotestorage.js/blob/1966eed75e2e4c81d5410b5a500cddf1f63a1cc0/src/caching.ts#L112)

***

### set()

> **set**(`path`, `strategy`): `void`

Configure caching for a given path explicitly.

Not needed when using ``enable``/``disable``.

#### Parameters

• **path**: `string`

Path to cache

• **strategy**: `"ALL"` \| `"SEEN"` \| `"FLUSH"`

Caching strategy. One of 'ALL', 'SEEN', or 'FLUSH'.

#### Returns

`void`

#### Source

[caching.ts:28](https://github.com/remotestorage/remotestorage.js/blob/1966eed75e2e4c81d5410b5a500cddf1f63a1cc0/src/caching.ts#L28)
