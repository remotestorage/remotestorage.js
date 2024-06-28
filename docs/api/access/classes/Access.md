# Class: Access

Keeps track of claimed access and scopes.

## Accessors

### scopes

> `get` **scopes**(): `ScopeEntry`[]

Property: scopes

Holds an array of claimed scopes:

```js
[{ name: "<scope-name>", mode: "<mode>" }]
```

#### Returns

`ScopeEntry`[]

#### Source

[access.ts:44](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/access.ts#L44)

## Methods

### checkPathPermission()

> **checkPathPermission**(`path`, `mode`): `boolean`

Verify permission for a given path.

#### Parameters

• **path**: `string`

Path

• **mode**: `AccessMode`

Access mode

#### Returns

`boolean`

true if the requested access mode is active, false otherwise

#### Source

[access.ts:120](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/access.ts#L120)

***

### checkPermission()

> **checkPermission**(`scope`, `mode`): `boolean`

Verify permission for a given scope.

#### Parameters

• **scope**: `string`

Access scope

• **mode**: `AccessMode`

Access mode

#### Returns

`boolean`

true if the requested access mode is active, false otherwise

#### Source

[access.ts:108](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/access.ts#L108)

***

### claim()

> **claim**(`scope`, `mode`): `void`

Claim access on a given scope with given mode.

#### Parameters

• **scope**: `string`

An access scope, such as "contacts" or "calendar"

• **mode**: `AccessMode`

Access mode. Either "r" for read-only or "rw" for read/write

#### Returns

`void`

#### Source

[access.ts:62](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/access.ts#L62)

***

### get()

> **get**(`scope`): `AccessMode`

Get the access mode for a given scope.

#### Parameters

• **scope**: `string`

Access scope

#### Returns

`AccessMode`

Access mode

#### Source

[access.ts:79](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/access.ts#L79)

***

### remove()

> **remove**(`scope`): `void`

Remove access for the given scope.

#### Parameters

• **scope**: `string`

Access scope

#### Returns

`void`

#### Source

[access.ts:89](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/access.ts#L89)

***

### reset()

> **reset**(): `void`

Reset all access permissions.

#### Returns

`void`

#### Source

[access.ts:132](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/access.ts#L132)
