# Class: RemoteBase

The ancestor for WireClient, GoogleDrive & Dropbox

## Extends

- `EventHandling`

## Methods

### addEventListener()

> **addEventListener**(`eventName`, `handler`): `void`

Install an event handler for the given event name

Usually called via [`on()`](#on)

#### Parameters

• **eventName**: `string`

• **handler**: [`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

#### Returns

`void`

#### Inherited from

`EventHandling.addEventListener`

#### Source

[eventhandling.ts:29](https://github.com/remotestorage/remotestorage.js/blob/65f5343823175e12058c01e23219a8cc9d34932b/src/eventhandling.ts#L29)

***

### on()

> **on**(`eventName`, `handler`): `void`

Register an event handler for the given event name

Alias for [addEventListener](RemoteBase.md#addeventlistener)

#### Parameters

• **eventName**: `string`

Name of the event

• **handler**: [`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

Function to handle the event

#### Returns

`void`

#### Inherited from

`EventHandling.on`

#### Example

```ts
remoteStorage.on('connected', function() {
  console.log('storage account has been connected');
});
```

#### Source

[eventhandling.ts:55](https://github.com/remotestorage/remotestorage.js/blob/65f5343823175e12058c01e23219a8cc9d34932b/src/eventhandling.ts#L55)

***

### removeEventListener()

> **removeEventListener**(`eventName`, `handler`): `void`

Remove a previously installed event handler

#### Parameters

• **eventName**: `string`

• **handler**: [`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

#### Returns

`void`

#### Inherited from

`EventHandling.removeEventListener`

#### Source

[eventhandling.ts:62](https://github.com/remotestorage/remotestorage.js/blob/65f5343823175e12058c01e23219a8cc9d34932b/src/eventhandling.ts#L62)
