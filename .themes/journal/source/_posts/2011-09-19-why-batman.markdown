---
layout: post
title: "Why Batman?"
date: 2011-09-19 12:41
comments: true
featured_image: "/images/headers/batman.jpg"
photo_credit: "Carter Brundage"
categories: ['neat algos']
---

[Batman.js](http://batmanjs.org/) is [Shopify](http://shopify.com)'s new open source CoffeeScript framework, and I'm absolutely elated to introduce it to the world after spending so much time on it. Find Batman on GitHub [here](https://github.com/Shopify/batman).

Batman emerges into a world populated with extraordinary frameworks being used to great effect. With the incredible stuff being pushed out in projects like [Sproutcore 2.0](http://www.sproutcore.com/about/) and [Backbone.js](http://documentcloud.github.com/backbone/), how is a developer to know what to use when? There's only so much time to play with cool new stuff, so I'd like to give a quick tour of what makes Batman different and why you might want to use it instead of the other amazing frameworks available today.

<!--more-->

## Batman makes building apps easy

Batman is a framework for building single page applications. It's not a progressive enhancement or a single purpose DOM or AJAX library. It's built from the ground up to make building awesome single page apps by implementing all the lame parts of development like cross browser compatibility, data transport, validation, custom events, and a whole lot more. We provide handy helpers for development to generate and serve code, a recommended app structure for helping you organize code and call it when necessary, a full MVC stack, and a bunch of extras, all while remaining less than 18k when gzipped. Batman doesn't provide the basics, or the whole kitchen sink, but a fluid API that allows you to write the important code for your app and none of the boilerplate.

## A super duper runtime

At the heart of Batman is a runtime layer used for manipulating data from objects and subscribing to events objects may emit. Batman's runtime is used similarly to SproutCore's or Backbone's in that all property access and assignment on Batman objects must be done through `someObject.get` and `someObject.set`, instead of using standard dot notation like you might in vanilla JavaScript. Adhering to this property system allows you to:

 * transparently access "deep" properties which may be simple data or computed by a function,
 * inherit said computed properties from objects in the prototype chain,
 * subscribe to events like `change` or `ready` on other objects at "deep" keypaths,
 * and most importantly, dependencies can be tracked between said properties, so chained observers can be fired and computations can be cached while guaranteed to be up-to-date.

All this comes free with every Batman object, and they still play nice with vanilla JavaScript objects. Let's explore some of the things you can do with the runtime. Properties on objects can be observed using `Batman.Object::observe`:

{% codeblock lang:coffeescript %}
crimeReport = new Batman.Object
crimeReport.observe 'address', (newValue) ->
  if DangerTracker.isDangerous(newValue)
    crimeReport.get('currentTeam').warnOfDanger()
{% endcodeblock %}

This kind of stuff is available in Backbone and SproutCore both, however we've tried to bring something we missed in those frameworks to Batman: "deep" keypaths. In Batman, any keypath you supply can traverse a chain of objects by separating the keys by a `.` (dot). For example:

{% codeblock lang:coffeescript %}
batWatch = Batman
  currentCrimeReport: Batman
    address: Batman
      number: "123"
      street: "Easy St"
      city: "Gotham"

batWatch.get 'currentCrimeReport.address.number' #=> "123"
batWatch.set 'currentCrimeReport.address.number', "461A"
batWatch.get 'currentCrimeReport.address.number' #=> "461A"
{% endcodeblock %}

This works for observation too:

{% codeblock lang:coffeescript %}
batWatch.observe 'currentCrimeReport.address.street', (newStreet, oldStreet) ->
  if DistanceCalculator.travelTime(newStreet, oldStreet) > 100000
    BatMobile.bringTo(batWatch.get('currentLocation'))
{% endcodeblock %}

The craziest part of the whole thing is that these observers will always fire with the value of whatever is at that keypath, even if intermediate parts of the keypath change.

{% codeblock lang:coffeescript %}
crimeReportA = Batman
  address: Batman
    number: "123"
    street: "Easy St"
    city: "Gotham"

crimeReportB = Batman
  address: Batman
    number: "72"
    street: "Jolly Ln"
    city: "Gotham"

batWatch = new Batman.Object({currentCrimeReport: crimeReportA})

batWatch.get('currentCrimeReport.address.street') #=> "East St"
batWatch.observe 'currentCrimeReport.address.street', (newStreet) ->
  MuggingWatcher.checkStreet(newStreet)

batWatch.set('currentCrimeReport', crimeReportB)
# the "MuggingWatcher" callback above will have been called with "Jolly Ln"
{% endcodeblock %}

Notice what happened? Even though the middle segment of the keypath changed (a whole new `crimeReport` object was introduced), the observer fires with the new deep value. This works with arbitrary length keypaths as well as intermingled `undefined` values.

The second neat part of the runtime is that because all access is done through `get` and `set`, we can track dependencies between object properties which need to be computed. Batman calls these functions `accessors`, and using the CoffeeScript executable class bodies they are really easy to define:

{% codeblock lang:coffeescript %}
class BatWatch extends Batman.Object
  # Define an accessor for the `currentDestination` key on instances of the BatWatch class.
  @accessor 'currentDestination', ->
    address = @get 'currentCrimeReport.address'
    return "#{address.get('number')} #{address.get('street')}, #{address.get('city')}"

crimeReport = Batman
  address: Batman
    number: "123"
    street "Easy St"
    city: "Gotham"

watch = new BatWatch(currentCrimeReport: crimeReport)

watch.get('currentDestination') #=> "123 Easy St, Gotham"
{% endcodeblock %}

Importantly, the observers you may attach to these computed properties will fire as soon as you update their dependencies:

{% codeblock lang:coffeescript %}
watch.observe 'currentDestination', (newDestination) -> console.log newDestination
crimeReport.set('address.number', "124")
# "124 Easy St, Gotham" will have been logged to the console
{% endcodeblock %}

You can also define the default accessors which the runtime will fall back on if an object doesn't already have an accessor defined for the key being `get`ted or `set`ted.

{% codeblock lang:coffeescript %}
jokerSimulator = new Batman.Object
jokerSimulator.accessor (key) -> "#{key.toUpperCase()}, HA HA HA!"

jokerSimulator.get("why so serious") #=> "WHY SO SERIOUS, HA HA HA!"
{% endcodeblock %}

This feature is useful when you want to present a standard interface to an object, but work with the data in nontrivial ways underneath. For example, `Batman.Hash` uses this to present an API similar to a standard JavaScript object, while emitting events and allowing objects to be used as keys.

## What's it useful for?

The core of Batman as explained above makes it possible to know when data changes as soon as it happens. This is ideal for something like client side views. They're no longer static bundles of HTML that get cobbled together as a long string and sent to the client, they are long lived representations of data which need to change as the data does. Batman comes bundled with a view system which leverages the abilities of the property system.

A simplified version of the view for [Alfred](http://batmanjs.org/examples/alfred.html), Batman's todo manager example application, lies below:

{% codeblock lang:html %}
<h1>Alfred</h1>

<ul id="items">
    <li data-foreach-todo="Todo.all" data-mixin="animation">
        <input type="checkbox" data-bind="todo.isDone" data-event-change="todo.save" />
        <label data-bind="todo.body" data-addclass-done="todo.isDone" data-mixin="editable"></label>
        <a data-event-click="todo.destroy">delete</a>
    </li>
    <li><span data-bind="Todo.all.length"></span> <span data-bind="'item' | pluralize Todo.all.length"></span></li>
</ul>
<form data-formfor-todo="controllers.todos.emptyTodo" data-event-submit="controllers.todos.create">
  <input class="new-item" placeholder="add a todo item" data-bind="todo.body" />
</form>
{% endcodeblock %}

We sacrifice any sort of transpiler layer (no HAML), and any sort of template layer (no Eco, jade, or mustache). Our views are valid HTML5, rendered by the browser as soon as they have been downloaded. They aren't JavaScript strings, they are valid DOM trees which Batman traverses and populates with data without any compilation or string manipulation involved. The best part is that Batman "binds" a node's value by observing the value using the runtime as presented above. When the value changes in JavaScript land, the corresponding node attribute(s) bound to it update automatically, and the user sees the change. Vice versa remains true: when a user types into an input or checks a checkbox, the string or boolean is set on the bound object in JavaScript. The concept of bindings isn't new, as you may have seen it in things like Cocoa, or in [Knockout](http://knockoutjs.com/) or Sproutcore in JS land.

We chose to use bindings because we a) don't want to have to manually check for changes to our data, and b) don't want to have to re-render a whole template every time one piece of data changes. With mustache or `jQuery.tmpl` and company, I end up doing both those things surprisingly often. It seems wasteful to re-render every element in a loop and pay the penalty for appending all those nodes, when only one key on one element changes, and we could just update that one node. SproutCore's 'SC.TemplateView' with Yehuda Katz' [Handlebars.js](http://www.handlebarsjs.com/) do a good job of mitigating this, but we still didn't want to do all the string ops in the browser, and so we opted for the surgical precision of binding all the data in the view to exactly the properties we want.

What you end up with is a fast render with no initial loading screen, at the expense of the usual level of complex logic in your views. Batman's view engine provides conditional branching, looping, context, and simple transforms, but thats about it. It forces you to write any complex interaction code in a packaged and reusable `Batman.View` subclass, and leave the HTML rendering to the thing that does it the best: the browser.

## More?

Batman does more than this fancy deep keypath stuff and these weird HTML views-but-not-templates. We have a routing system for linking from quasi-page to quasi-page, complete with named segments and GET variables. We have a `Batman.Model` layer for retrieving and sending data to and from a server which works out of the box with storage backends like Rails and `localStorage`.  We have other handy mixins for use in your own objects like `Batman.StateMachine` and `Batman.EventEmitter`. And, we have a lot more on the ay. I strongly encourage you to check out the [project website](http://batmanjs.org/), the [source on GitHub](https://github.com/Shopify/batman), or visit us in [#batmanjs on freenode](irc://freenode.net/batmanjs). Any questions, feedback, or patches will be super welcome, and we're always open to suggestions on how we can make Batman better for you.

Until next time....

<iframe width="560" height="345" src="http://www.youtube.com/embed/X0UJaprpxrk" frameborder="0" allowfullscreen></iframe>

<br/>
_This article has been crossposted to the [Shopify](http://www.shopify.com/) Technology blog [here](http://www.shopify.com/technology/4080092-how-batman-can-help-you-build-app)._

