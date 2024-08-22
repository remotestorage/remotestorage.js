# Using the Connect Widget add-on

The easiest option for letting people connect their storage to your app
is using the Connect Widget add-on library, which is written and
maintained by the rs.js core team.

This is optional and an easy way to integrate all functionality into your own
UI. It's a great way to start with RS app development and can be replaced with
custom code later on.

## Adding the library

The Connect Widget library is distributed the same way as
remoteStorage.js itself: as a
<abbr title="Universal Module Definition">UMD</abbr>
build, compatible with all JavaScript module systems, or as a global
variable named `Widget`, when linked directly.

You can find the connect widget as
[`remotestorage-widget`](https://www.npmjs.com/package/remotestorage-widget) on
npm, and its source code and usage instructions [on
GitHub](https://github.com/remotestorage/remotestorage-widget).

Check out [Adding rs.js to an app](how-to-add) for examples of loading a UMD
module in your code.

## Adding the widget

With the `Widget` class loaded, create a new widget instance using the
[previously initialized](initialize-and-configure) `remoteStorage` instance,
like so:

```js
const widget = new Widget(remoteStorage);
```

Then you can attach the widget to the
[DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model):

```js
widget.attach();
```

Or if you want to attach it to a specific parent element, you can also
hand it a DOM element ID:

```js
widget.attach('my-parent-element-id');
```

That's it. Now your users can use the widget in order to connect their storage,
and you can listen to the [RemoteStorage][1] instance's events in order to get
informed about connection status, sync progress, errors, and so on.

::: tip
If you'd like to implement connect functionality in your own user
interface and code, the widget can serve as a useful source code
example. For everything it does, the Connect Widget only uses public
APIs and events of rs.js, which you can also use in your own code.
:::

[1]: ../api/remotestorage/classes/RemoteStorage.html
