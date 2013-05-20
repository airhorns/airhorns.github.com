---
layout: post
title: "Converting from Jasmine to QUnit"
date: 2011-05-11 12:41
comments: true
featured_image: "/images/headers/qunit.jpg"
photo_credit: "Carter Brundage"
categories: ['neat algos']
---

I had to convert a sizeable test suite from [Jasmine](https://github.com/pivotal/jasmine/wiki) to [QUnit](http://docs.jquery.com/QUnit). The former has a wide array of matchers and situation specific helpers for explicitly testing things, and the latter is about as barebones as it gets. This is all well and good, it just means converting is a pain.

First, here are some regexes to help. These are vim substitution commands, but you should be able to adapt them for any editor with a regex find & replace. Also, these were written for Coffeescript code which had some optional brackets here and there, so YMMV, but hopefully they are useful.

    %s/\vdescribe "(.+)", \-\>/module "\1"/
    %s/\vit "/test "/
    %s/\vexpect\((.+)\)\.toEqual\(?(.+)\)?/equals \1, \2/
    %s/\vexpect\((.+)\)\.toBeTruthy\(\)/ok \1/
    %s/\vjasmine\.createSpy/createSpy/
    %s/\vexpect\((.+)\).toHaveBeenCalledWith\((.+)\)/deepEqual \1.lastCallArguments, [\2]/
    %s\vbeforeEach \-\>/setup: ->/

We change `describe` calls to `module`, `it "..."` to `test "..."`, some basic expectations from Jasmine to the equivalents in QUnit, and then the `beforeEach` calls from Jasmine to `setup` options for the `module call`. This got me most of the way there, after running them I had to fix the indentation, ensure the `setup: ` stuff was passed as an option to `module` (it was a function call before), and fix some brackets here and there. If you come up with more or better regexes please leave a comment and I'll add them to the post!

Next, I ripped out a very simple version of the [`jasmine.Spy`](https://github.com/pivotal/jasmine/wiki/Spies) object which I started to really miss in QUnit. This is my super basic copy of the Jasmine implementation, suitable for both command line execution through [node-qunit](https://github.com/kof/node-qunit) or the in browser test runner.

{% codeblock lang:coffeescript %}
exports = if window? then window else global

class Spy
  constructor: (original) ->
    @called = false
    @callCount = 0
    @calls = []
    @original = original
    @fixedReturn = false

  whichReturns: (value) ->
    @fixedReturn = true
    @fixedReturnValue = value
    @

createSpy = (original) ->
  spy = new Spy

  f = (args...) ->
    f.called = true
    f.callCount++
    f.lastCall =
      object: this
      arguments: args

    f.lastCallArguments = f.lastCall.arguments
    f.calls.push f.lastCall

    unless f.fixedReturn
      f.original?.call(this, args...)
    else
      f.fixedReturnValue

  for k, v of spy
    f[k] = v

  f

spyOn = (obj, method) ->
  obj[method] = createSpy(obj[method])

exports.createSpy = createSpy
exports.spyOn = spyOn
{% endcodeblock %}

Hopefully this will be of use to you if you end up doing anything similar! I have this here mostly for future reference but I hope it helps at least one of you tube surfers out there.

