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

#### Defined in

[eventhandling.ts:29](https://github.com/remotestorage/remotestorage.js/blob/9625dcb362d5fe51be7b7fbdbb04492cfbf19644/src/eventhandling.ts#L29)

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

#### Example

```ts
remoteStorage.on('connected', function() {
  console.log('storage account has been connected');
});
```

#### Inherited from

`EventHandling.on`

#### Defined in

[eventhandling.ts:55](https://github.com/remotestorage/remotestorage.js/blob/9625dcb362d5fe51be7b7fbdbb04492cfbf19644/src/eventhandling.ts#L55)

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

#### Defined in

[eventhandling.ts:62](https://github.com/remotestorage/remotestorage.js/blob/9625dcb362d5fe51be7b7fbdbb04492cfbf19644/src/eventhandling.ts#L62)
