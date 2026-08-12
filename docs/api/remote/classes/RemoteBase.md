# Class: RemoteBase

Defined in: [remote.ts:8](https://github.com/remotestorage/remotestorage.js/blob/99feed53fb7138821307670428659d0d1b82ee1c/src/remote.ts#L8)

The ancestor for WireClient, GoogleDrive & Dropbox

## Methods

### addEventListener()

> **addEventListener**(`eventName`, `handler`): `void`

Defined in: [eventhandling.ts:29](https://github.com/remotestorage/remotestorage.js/blob/99feed53fb7138821307670428659d0d1b82ee1c/src/eventhandling.ts#L29)

Install an event handler for the given event name

Usually called via [`on()`](#on)

#### Parameters

##### eventName

`string`

##### handler

[`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

#### Returns

`void`

#### Inherited from

`EventHandling.addEventListener`

***

### on()

> **on**(`eventName`, `handler`): `void`

Defined in: [eventhandling.ts:55](https://github.com/remotestorage/remotestorage.js/blob/99feed53fb7138821307670428659d0d1b82ee1c/src/eventhandling.ts#L55)

Register an event handler for the given event name

Alias for [addEventListener](#addeventlistener)

#### Parameters

##### eventName

`string`

Name of the event

##### handler

[`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

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

***

### removeEventListener()

> **removeEventListener**(`eventName`, `handler`): `void`

Defined in: [eventhandling.ts:62](https://github.com/remotestorage/remotestorage.js/blob/99feed53fb7138821307670428659d0d1b82ee1c/src/eventhandling.ts#L62)

Remove a previously installed event handler

#### Parameters

##### eventName

`string`

##### handler

[`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

#### Returns

`void`

#### Inherited from

`EventHandling.removeEventListener`
