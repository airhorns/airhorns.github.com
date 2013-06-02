---
layout: post
title: "Neat Algorithms - Harmony Search"
date: 2011-07-05 12:41
comments: true
featured_image: "/images/headers/harmony.jpg"
photo_credit: "Carter Brundage"
categories: ['neat algos']
---
Here I'll try and demonstrate a neat optimization algorithm based on the principles of performing jazz musicians by applying it to solve Sudoku puzzles.

Harmony Search (often abbreviated HS) is a [metaheuristic optimization](http://en.wikipedia.org/wiki/Metaheuristic) algorithm pioneered by [Dr Zong Woo Geem](https://sites.google.com/a/hydroteq.com/www/). Metaheuristic algorithms like harmony search attempt to find the optimal input to some objecting measure of quality, or in other words, find the "best" solution to a given problem. Harmony search has been successfully applied to a vast array of such problems, such as the Travelling Salesman problem, water network design, and actual algorithmic music generation.

See the algorithm in action:

<div id="searchVis"></div>

# Table of Contents

 1. <a href="#searchVis">Demo</a>
 2. <a href="#heuristics">Intro to Metaheuristics</a>
 3. <a href="#harmony_search">Harmony Search</a>
 4. <a href="#exam_example">Exam Mark Demo</a>
 5. <a href="#sudoku_example">Sudoku Demo and Analysis</a>

# About this page

This page features interactive demos and code examples, all written in [Coffeescript](http://coffeescript.org/). It shouldn't be too hard to pick up if you haven't seen it before, but visit that page if you want a quick primer on the syntax. If thats too much to ask, know that variables prefixed with `@` symbols signify instance variables, and that the last value of a block is the implicit return value, and you should be good. The example code you see in the post is also a distilled, unoptimized, nuance-lacking version which gets rid of the boring stuff for your benefit, so don't make fun if it seems slow.

Also, the computationally intense demo above has an intensity setting you can pick. Pick `poutine` mode only if you run Chrome or want to watch your browser get crushed. The first three settings defer to the UI thread often enough to stay responsive, but `poutine` mode uses web workers to destroy FF3, FF4, and Opera on my machine faster than you can say "higgitus figgitus". `Poutine` mode is called as such because the browser gobbles up CPU power like I gobble up the aforementioned artery clogger at 3 AM on a Saturday night. Very quickly.

<h1 id="heuristics">Heuristics and Fitness</h1>

Harmony search as well as the above mentioned algorithms are useful for solving a very wide class of problems. Below we'll apply it to one problem in particular, but first lets examine the role of a metaheuristic algorithm.

The central idea is that when trying to solve some given optimization problem, you have some set of input variables that can be evaluated for their quality, and you want to know what inputs produce the best quality. Metaheuristic algorithms try to find this global optimum using some strategy which is better than brute force. For problems where it is hard to decipher why changing an input changes the quality (and thus the optimal solution isn't very obvious), these algorithms are extremely useful. Harmony search and its siblings in this category do not guarantee that the globally optimal solution will be found, but often they do find it, and they are often much more efficient than an exhaustive brute force search of all input combinations.

## A Basic Example

Say I have a killer exam tomorrow, and I have function which represents what mark I'll get depending on how much time I spend studying and how much time I spend sleeping. For the sake of the example, we'll say that I can spend a maximum of 10 hours doing either activity, and any time I don't spend doing either activity will be filled by normal day to day activities. The problem is I'll get burned out if I study too much, but I won't pass if I don't study enough. I could also be groggy during the exam I sleep too much, or be weary and slow if I don't sleep enough. How do I balance the time before the exam appropriately, given that I have this magical function which predicts the future?

<figure class="big">
  <figcaption>The problem space shown as a heat map.</figcaption>
  <div id="sleepMap"></div>
</figure>

To the left is a heat map showing where the best marks are earned. You'll find the hours spent studying on the X axis and the hours spent sleeping on the Y axis, and the mark achieved encoded in the color at that point on the map. A white color represents 100%, and a black color represents a failing grade. You can see that around the edges of the map the colors are darker, indicating a poorer mark. There also appears to be a hotspot right in the middle at about 5 hours spent studying and 8 hours spent sleeping. This is easy for us to see because the data is laid out in such a way we can see the whole problem space at once, and see the exact range of marks earned just by looking at the colors. Us humans can identify a pattern of increasing marks by watching the colors get closer to white as the inputs approach that sweet spot.

The task of an optimization algorithm is to do exactly what we do with our eyes on the heat map. It can also search non differentiable functions, or functions which few assumptions can be made. Also note that this exam example is a tad silly, because every input combination is represented in that heat map, so we could write a brute force program to just try them all and find the max pretty easily and quickly. To make it even worse, the source code for the relatively simple and continuous quality function is also in this page, so just applying some first year calculus we can find the global maximum. For computationally complex functions of many more variables, or non differentiable functions, these brute force and calculus approaches aren't feasible, and we are left to find a better strategy.

<h1 id="harmony_search">Enter Harmony Search</h1>

Harmony search is one such strategy for finding an optimal set of inputs to an often complicated quality function, among others like random search, simulated annealing, genetic algorithms, and tabu search. It works by imitating the activity of musicians while improvising. The choice of which note to play next while playing as part of a trio or quartet is something which takes years to learn to do effectively, because its hard to know what notes your accompaniment might play, and its hard to know what notes might sound good or great in tandem with the others. Musicians can be seen as trying to play some set of notes simultaneously to produce a _fantastic harmony_, although this is a somewhat naive take on the whole thing, so don't let me ruin the magic for you.

Each musician in the ensemble is often faced with the problem of picking the next note. To do so they can reference their knowledge of the notes in the key they are playing in (what notes sound good in the context of the song), as well as the notes they've played previously (what notes sound good in the recent context). The notes they played recently most likely sounded alright, so often these are a good choice. Also, it can be wise to pick a particular note that the audience might expect and adjust the pitch of it away from the expected note to create an artistic effect and a new, potentially better, harmony.

These decisions that said bland hypothetical musician makes correspond exactly to how harmony search works. Harmony search seeks an optimal combination of inputs, just as a musician seeks a fantastic harmony. Harmony search generates "harmonies" of inputs which it then evaluates for quality, and iterates this process until it finds the best one possible. The quality of a musical harmony is analogous to the quality of a particular solution, so you might say that harmony search is trying to achieve a _fantastic_ combination of inputs, or that musicians are trying to _optimize_ the note selection problem using their own heuristics.

Each input to the problem is seen as a different instrument in an ensemble, each potential note one of those instruments could play corresponds to each potential value on of the inputs of the function might adopt. The musical harmony of notes is modeled as a programmatic harmony of values. We evaluate the former's quality using our ears, and the latter's using a quality function describing the problem.

## Improvising New Solutions

Harmony search continues to use the musician metaphor to iteratively improve its solution. Each search iteration of the algorithm generates a new harmony to evaluate for quality. Using the note selection strategies mentioned previously, notes for each instrument, or values for each input, are selected. These inputs are fed to the quality function to determine the harmony's quality. The notes are selected for each instrument by either randomly selecting a note from the range of playable notes, selecting a note from the set of recently played ones, and/or occasionally adjusting the pitch of a note up or down.

## Getting better

Each iteration a new harmony is generated, its quality is calculated, and if it makes the cut it's "included" in the musician's memory. This way, iteration by iteration, old, poor quality harmonies are kicked out and replaced by better ones. The average quality of the set of harmonies in this memory as a whole gradually increases as these new harmonies replace poor ones. The brilliance of the algorithm comes from this: the new harmonies that are generated, which you may recall often reference notes from the memory, start to use notes belonging to known high-quality harmonies. Thus, the newly generated harmonies use good notes, and often have higher qualities because of it. This process repeats, where the increasing the quality of individual harmonies generated increases the average quality of the memory, which increases the quality of the individual generated harmonies, and so on and so forth. At some point (it is hoped), the algorithm generates a harmony which meets the "fantastic" quality hoped for.

Thats it! Harmony search isn't too complicated, but its a neat algorithm inspired by some everyday natural phenomena. Read on for the code and an example application.

# The Code

First, lets more formally define some terms.

 + __Instrument__: One of the inputs to the quality function.
 + __Note__: One of the possible values of an input.
 + __Harmony__: A combination of each instrument playing a particular note, or in reality the set of chosen inputs for each argument to the quality function.
 + __Quality__: A quantitative measure of a harmony's desirability, how close or far it is from the _fantastic_ harmony, or optimal solution.
 + __Harmony Memory__: The collection of good harmonies, stored in memory for examination by the harmony generation algorithm.
 + __Harmony Memory Consideration__: The process of generating a new harmony using random notes from the harmony memory.
 + __Pitch Adjustment__: The process of moving a particular instrument's note up or down

## Pseudo code for the actual algorithm

 1. Initialize the Parameters for Problem and Algorithm.
 2. Initialize the Harmony Memory (HM).
 3. Improvise a New Harmony.
 4. Update the Harmony Memory if the new harmony is better than the worst harmony in the memory.
 5. Check the stopping criterion, and if we can continue, go back to 3.

## The Parts

The algorithm, once applied to a problem, is composed of 3 main parts:

 1. __The harmony generator__, which spits out new, potentially good harmonies based on the contents of the harmony memory and the set of possible notes
 2. __The quality function__, which evaluates a particular harmony for its quality.
 3. __The search algorithm__, which moves harmonies in and out of the memory based on their quality.

I chose to encapsulate the generator and the search algorithm into a `HarmonySearch` class, and to make the whole thing reusable by making a `Harmony` class which in a particular problem would be extended to implement the quality function.

Next, we'll define the formal parameters for the algorithm:

 + __Harmony Memory Consideration Rate__ or HMCR: the probability that when generating notes for a new harmony, a note from the harmony memory will be picked, instead of just picking a random one out of the possible notes
 + __Pitch Adjustment Rate__ or PAR: the probability of randomly shifting a note up or down once it has been chosen

## The skeleton

Here's the skeleton for the `HarmonySearch` class:

{% codeblock lang:coffeescript %}
class HarmonySearch
  @defaults:
    maxTries: 100
    targetQuality: Infinity
    harmonyMemorySize: false
    harmonyMemoryConsiderationRate: .95
    pitchAdjustmentRate: .1
    instruments: 10
    notes: [1,2,3,4,5,6,7,8,9 ]
    harmonyMemorySize: 10

  constructor: (options) ->
    @options = _.extend {}, HarmonySearch.defaults, options
{% endcodeblock %}

All this does is define the defaults for the algorithm.

Here's the basic, extendable `Harmony` class:

{% codeblock lang:coffeescript %}
class Harmony
  # Pull out the note and index of the note from the chord, passed in
  # in the [[note_1, index_1], [note_2, index_2], ...] format
  constructor: (chord) ->
    @notes = []
    @noteIndicies = []
    for i, info of chord
      @notes[i] = info[0]
      @noteIndicies[i] = info[1]

  # Cache the quality calculation
  quality: ->
    @_quality ?= this.calculateQuality()
    @_quality

  calculateQuality: ->
    throw "Extend this class to define how a harmony's quality is evaluated"
{% endcodeblock %}

The above class manages the generic parts of the search. To apply it to a particular optimisation problem, we subclass `Harmony` and define a quality calculation which suits the problem at hand. Below we'll apply it to the exam mark problem mentioned above, and then after a less trivial sudoku problem.

## The Harmony Generator

This is the first component of the `HarmonySearch` class, responsible for spitting out new harmonies based upon those stored in the harmony memory, as well as the HMCR and the PAR.

{% codeblock lang:coffeescript %}
class HarmonySearch
  # Generate a totally random harmony
  getRandomHarmony: ->
    chord = for i in [0..@options.instruments-1]
        index = Math.floor(Math.random() * @options.notesLength)
        [@options.notes[index], index]

    new @options.harmonyClass(chord)

  # Generate a new harmony based on the HMCR and the PAR
  getNextHarmony: ->
    chord = for i in [0..@options.instruments-1]

      if Math.random() < @options.harmonyMemoryConsiderationRate
        # Consider HM. Pick a random harmony, and sample the note at this position in the chord
        harmonyMemoryIndex = Math.floor(Math.random()*@options.harmonyMemorySize)
        note = @harmonyMemory[harmonyMemoryIndex].notes[i] # Grab note for this instrument
        noteIndex = @harmonyMemory[harmonyMemoryIndex].noteIndicies[i]

        # Do pitch adjustment
        if Math.random() < @options.pitchAdjustmentRate
          # Adjust the pitch up or down one
          adjustment = if Math.random() > 0.5 then 1 else -1
          noteIndex = (noteIndex + adjustment + @options.notesLength) % @options.notesLength
          note = @options.notes[noteIndex]

      else
        # Don't consider the HM. Pick a random note from all possible values.
        noteIndex = Math.floor(Math.random() * @options.notesLength)
        note = @options.notes[noteIndex]

      # Return chosen note for the chord
      [note, noteIndex]

    new @options.harmonyClass(chord)
{% endcodeblock %}

Hopefully all this secondary stuff isn't too confusing, but if it is, the next section brings it all together and hopefully will make it all clear.

Also note that each `Harmony` class stores both an array of notes and an array of note indices, which seems a tad odd. This is because in the above code the pitch adjustment portion needs access to the original index of the note in the array of possible notes, so it can find the next or previous index to adjust to. Thats why the `Harmony` class constructor accepts the `[[note, index], [note2, index2], ...]` style arguments, and the above accumulator returns `[note, noteIndex]`, instead of just doing arrays of notes.

## The Core

Below is the core of the search algorithm, which actually executes the whole search process by generating new harmonies and moving them into the harmony memory if they are better than the current worst.

{% codeblock lang:coffeescript %}
class HarmonySearch

  search: (callback) ->
    # Initialize harmony memory
    @running = true
    @harmonyMemory = for i in [1..@options.harmonyMemorySize]
      this.getRandomHarmony()

    # Initialize tracker variables for the loop
    @tries = 0
    [worstQuality, worstIndex] = this._getWorst()
    [bestQuality, bestIndex] = this._getBest()

    # Iterate over the search until either the target quality is hit,
    # or the max iterations condition is passed.
    while true
      @tries++ # Increment tries counter each loop for end condition check

      # Check end condition
      if @tries > @options.maxTries || bestQuality >= @options.targetQuality
        break # We either found it or exhausted the alloted time

      # Otherwise, generate another harmony
      harmony = this.getNextHarmony()
      if harmony.quality() > worstQuality
        # Better than worst harmony. Add this harmony to the memory and delete the worst.
        @harmonyMemory.push(harmony)
        @harmonyMemory.splice(worstIndex, 1) # Javascript for Array#delete

        # Update the worst quality for the next loop iteration
        [worstQuality, worstIndex] = this._getWorst()

        # Track the best quality to see if we've met the target quality
        if harmony.quality() > bestQuality
          bestQuality = harmony.quality()

    [bestQuality, bestIndex] = this._getBest()
    return @harmonyMemory[bestIndex]
{% endcodeblock %}

Thats about it! Feeling ok? Read on for a couple examples to gel all of this.

<h1 id="exam_example">Exam Mark Example</h1>

Consider the exam mark problem shown above. Suppose the mysterious exam mark equation has been implemented in a Javascript function called `Exam.mark(timeSleeping, timeStudying)`.

    :::coffeescript
    $ Exam.mark
    # => function(timeSleeping, timeStudying) { ... }
    $ Exam.mark(0, 0)
    # => 30
    $ Exam.mark(10,10)
    # => 50

We're trying to find the global optimum to this equation. To model this in harmony search, we ask how many instruments there are, what notes each of them can play, and how to determine the quality of the harmony produced.

In this case, the `Exam.mark` equation is the one we are trying to optimize. We model its input arguments as notes, and use harmonies composed of different combinations of times. There are two instruments, one for each argument to the function, and each instrument can "play" any number between 0 and 10, which are the bounds as outlined in the problem. A harmony's quality is the mark achieved when the time is spent in it's particular allotment, which we model as the evaluation of the `Exam.mark` function for the two notes.

The harmony class we'd use for this problem would look like this:

{% codeblock lang:coffeescript %}
    class ExamHarmony extends Harmony
      quality: -> Exam.mark(@notes[0], @notes[1])
{% endcodeblock %}

That's not so bad right? We'd then run the search for some sufficiently large number of iterations and look at the output.

{% codeblock lang:coffeescript %}
search = new HarmonySearch {
  harmonyClass: ExamHarmony
  notes: [0,1,2,3,4,5,6,7,8,9,10]
  instruments: 2
  targetQuality: 100
  maxIterations: 2000
}
results = search.search()
{% endcodeblock %}

After this, results should hold the best quality `Harmony` found.

## Demo

<div id="examsearchVis"></div>

Harmony Search is run live to power the visualization above, as well as the one at the top of the page. Each wedge in the purple circle represents a harmony in the memory, and so the circle is the whole HM. Each wedge is labeled by its quality, and as harmonies grow closer to the target quality, the color of their wedges grow more purple. The best and worst harmonies are are also highlighted using a green or red border. Feel free to click on a harmony to see it's location on the heat map, and judge how close it is to the optimal point. Also, notice how new harmonies are added at the top of the circle and progress clockwise as new ones are added and poor ones are removed. The best harmonies will travel all the way around the circle but not get bumped out, and end up at the back for a long period of time, contributing good quality notes to the new harmonies being generated.

The grid of numbers to the right represents the selection of the notes in each new harmony. The harmony at the top of the list (with all the lines stemming from it) is the most recent addition to the harmony memory, and each line below is a progressively older harmony in the memory. Each note in the 1st row is generated either by picking a note from the set of those previously chosen in the memory, or by picking one randomly from the set of possible notes. Those chosen from the memory are signified by a grey line pointing towards the harmony from which the note was chosen. If pitch adjustment is applied, the line becomes blue. Otherwise, the note is chosen randomly, which is signified by a purple line pointing upwards into the set of notes possible for each note in the harmony. You'll only notice this in the Sudoku demo above, because there isn't enough room to show all the possibilities with the exam example.

<h1 id="sudoku_example">Sudoku Example</h1>

Harmony search can be applied to more complex problems than simple functions like the above. Sudoku is a specific case of the graph coloring problem, one of [Karp's 21 NP-complete problems](http://en.wikipedia.org/wiki/Karp%E2%80%99s_21_NP-complete_problems). In other words, its very time consuming to brute force the solution to a sudoku by just trying random numbers and seeing if they work. There are excellent algorithms that often run faster than harmony search or any of its metaheuristic brethren which solve the sudoku using intelligent, problem aware methods and guess when needed.

These "smart" solvers are I'm sure the algorithms employed by true Sudoku software, but they rely on intimate knowledge of the Sudoku solving process and an understanding of the techniques used. We have to encode our knowledge of how to solve sudokus into a program, implementing the guessing feature, the backtracking, and all the methods for eliminating possibilities for a particular cell. Instead of developing an algorithm like this, we can use a search method to find us a solution as long as we have a heuristic to tell the quality of a given solution. By solving them in this way, we don't need to concern ourselves with finding a general method or exploring edge cases or algorithmic nuances, and we let the search algorithm figure these things out on its own. We are able to lift the burden of understanding the relationship between the input variables from our own shoulders, and instead allow the algorithm to explore these relationships itself.

Hopefully you can see the advantage of using a search algorithm for problems where the smart, human written implementation is hard or impossible to create. If we have some measure of quality for a solution, and thus a way to tell when a solution is optimal, we can let the search algorithm, well, search.

## The Sudoku Model

Let's solve a particular Sudoku puzzle using harmony search. First, let us identify what the notes of a harmony are, and after, how to calculate the quality of one.

First off, notice that for any solution to be considered as such, each cell must have a value. Some of the values are given by the puzzle, and some must be decided by us. We seek a choice for each cell such that there are no conflicts, or in other words, the optimal solution to a sudoku is one which has all the cells filled in and breaks no rules.

We model the value of each one of the unknown cells as one note in a harmony, with the note's value being an integer between 1 and 9. The harmony is the chord struck when we insert each of these choices into the puzzle, and the quality of the solution is how close to a valid filled-in puzzle this solution is. The order the array of notes is entered into the puzzle doesn't really matter all that much, as long as it is consistent the algorithm will work just the same. The number of instruments is the count of unsolved cells.

<figure><table class="sudoku_game"><tr><td class="violated">2</td><td class="fixed">5</td><td class="good">4</td><td class="fixed">3</td><td class="boring">1</td><td class="fixed">6</td><td class="good">8</td><td class="boring">9</td><td class="fixed">7</td></tr><tr><td class="good">7</td><td class="violated">6</td><td class="good">3</td><td class="good">9</td><td class="fixed">8</td><td class="fixed">5</td><td class="boring">1</td><td class="fixed">2</td><td class="fixed">4</td></tr><tr><td class="good">1</td><td class="fixed">9</td><td class="fixed">8</td><td class="fixed">4</td><td class="fixed">2</td><td class="good">7</td><td class="fixed">6</td><td class="boring">5</td><td class="fixed">3</td></tr><tr><td class="fixed">9</td><td class="good">8</td><td class="fixed">1</td><td class="violated">7</td><td class="violated">5</td><td class="fixed">3</td><td class="fixed">2</td><td class="violated">5</td><td class="fixed">6</td></tr><tr><td class="violated">2</td><td class="fixed">3</td><td class="violated">2</td><td class="violated">7</td><td class="good">4</td><td class="violated">8</td><td class="violated">7</td><td class="fixed">1</td><td class="boring">5</td></tr><tr><td class="fixed">5</td><td class="boring">4</td><td class="fixed">7</td><td class="fixed">2</td><td class="fixed">6</td><td class="boring">1</td><td class="fixed">9</td><td class="good">3</td><td class="fixed">8</td></tr><tr><td class="fixed">4</td><td class="violated">6</td><td class="fixed">5</td><td class="boring">6</td><td class="fixed">9</td><td class="boring">2</td><td class="fixed">3</td><td class="fixed">8</td><td class="boring">1</td></tr><tr><td class="good">3</td><td class="fixed">1</td><td class="violated">6</td><td class="fixed">5</td><td class="fixed">7</td><td class="boring">8</td><td class="boring">4</td><td class="violated">9</td><td class="fixed">2</td></tr><tr><td class="fixed">8</td><td class="good">2</td><td class="violated">6</td><td class="fixed">1</td><td class="boring">3</td><td class="fixed">4</td><td class="boring">5</td><td class="fixed">7</td><td class="violated">9</td></tr></table><figcaption>A sudoku puzzle in the process of being solved.</figcaption></figure>

To the left is an example solution proposed in an early iteration of harmony search.

 <ul class="sudoku_legend"><li><span class="good">Green</span> cells don't violate any rules</li><li><span class="violated">Red</span> cells violate either row, column, or block rules</li><li><span class="boring">Grey</span> cells have only one possible value based on the clues</li><li><span class="clue">White</span> cells are given in the puzzle (a "clue" cell)</li></ul>

The green, grey, and red cells represent the choices for all of the unknown cells.

Next, we decide how to evaluate the quality of a given solution. The most obvious algorithm is just a count of the violations in the puzzle, which is just a count of the red cells in the solution. In my tests this heuristic worked a tad less effectively than a slightly different heuristic proposed by Dr Zong Woo Geem in [1]. The optimal solution is the global minimum of \\( Q\\), where

<div class="math">
  $$
  Q = \sum\limits_{i = 1}^9 \left| \sum\limits_{j = 1}^9  S_{i,j}  - 45 \right|
  + \sum\limits_{j = 1}^9 \left| \sum\limits_{i = 1}^9  S_{i,j}  - 45 \right|
  + \sum\limits_{k = 1}^9 \left| \sum_{ (i,j) \in B_k}  S_{i,j}  - 45 \right|
  $$

  where \( S_{i,j} \) is the cell \( i\) spaces over from the left and \( j\) spaces down from the top, and  \( B_k \) is all the cells in the k<sup>th</sup> box.
</div>

<br/>
The above heuristic gives a more detailed measure of a solutions quality. It works by taking the sum of each row and subtracting 45, which is the sum of the numbers from 1 to 9. If a particular row has two 1s instead of a 1 and a 2, the sum of the numbers in the row won't be 45, and \\( Q \\) won't be minimal. A correct solution for a sudoku would have \\( Q = 0 \\). As noted in [1], its important to see that the sum of a row may be 45 even though the numbers in it are not exactly the set from 1 to 9. The numbers in a row might just happen to sum to 45, for example \\( sum\\ \\{ 1,2,2,5,5,6,7,8,9 \\} = 45 \\). However, if this case occurs in one row, then the sum for the columns passing through the row, or the sum for one of the boxes containing the row won't be 45, moving the final value of \\( Q \\) away from 0, and thus denoting a sub optimal quality as desired. The only way to get a row, column, and box sum of 45 is to have precisely the set from 1 - 9 in each container.

In summary, the notes for a harmony are the set of values for the unknown cells, and the quality of the harmony is the evaluation of the function \\( Q \\) on the generated sudoku puzzle. With these two decisions made, we can now use harmony search to find a solution (if one exists) to a given sudoku puzzle.

## Code

The code for the sudoku example is boring and unfortunately long, but you can see it on Github if you'd like. The same `HarmonySearch` class as defined above would be used to search the problem space, and a harmony's quality would be calculated using the \\( Q \\) function above.

Also, a quick side note: the `HarmonySearch` class tries to _maximize_ a given quality, whereas \\( Q \\) gets _smaller_ as the input approaches a valid solution. Because of this, I used \\( 135 - Q \\) instead of just \\( Q \\) to calculate the quality of a harmony. As \\( Q \\) gets smaller, the quality of a harmony approaches 135, which we then define as the target quality.

## Discussion

The demo at the very top of the page implements Harmony Search in an attempt to solve a sudoku. I tried quite hard to achieve similar results to those to Geem's [1], but I was downright stumped. Geem managed to solve the default sudoku (the one called 'geem' in my simulation) in "285 improvisations", which to me is just absurdly low. It takes my implementation anywhere from 5000 to 50000 improvisations to find a valid solution, which is an awful lot more than 285. So I think I either made a serious mistake when implementing, a serious mistake when interpreting Geem's results, or discovered some academic fraud. I trust the inventor of the algorithm to be better at implementing it than I am, so I am pretty sure I made a blunder at some point or another.

The puzzle in question has 41 unsolved cells, giving a search space with 9^41 different solutions. That number has 40 digits. Its big. It's big enough that finding a solution after only 235 tries is really, really impressive. In an attempt to get my numbers down to at least the same order of magnitude, I tried precomputing the possible choices for each cell instead of letting each one be any number from 1 to 9. This is silly because it shows we don't need to use HS to solve this problem at all, because the algorithm to determine the possible choices for each cell is one that we could use to just solve the puzzle. If we can get the possible choices for a cell using some algorithm, we can just pick one choice, see if the solution works,and if not, pick the next choice, and repeat. We are implementing only the first step of the smart solving algorithm in order to make the dumb one just a tad smarter. If its possible for us to come up with an algorithm which can solve a sudoku deterministically instead of using a heuristic to search, we should most probably take the former approach.

In any case, adding in this precomputation step got the numbers down as expected because it drastically reduces the size of the search space, but still no where close to Geems. I don't know why this is the case, and I've spent an obscene amount of time trying to figure it out, but alas, I have been unable. If you can figure it out by looking at the code or just based on my (perhaps incorrect) description of the algorithm, do tell me so I can put this to rest.

Lastly, the above issues demonstrate that sudoku isn't really that good an example for a metaheuristic algorithms. We know that there are more efficient algorithms which solve them in itty bitty tiny amount of time, and unfortunately this solver algorithm isn't really that far from the quality heuristic we already have to write for HS. I also included no real strategy for dealing with unsolvable sudokus, which is a whole other class of [problem](http://en.wikipedia.org/wiki/Halting_problem). Shame on me for not dealing with these, but with this class of algorithm in particular its extraordinarily difficult. When using HS, there is no way to know if a solution exists or not until all possible harmonies have been tried. This brute force search is what we're trying to avoid by using a heuristic search. If our tries count reaches some user-defined ceiling, which is the stopping condition used in these demos, we wont know if a solution wasn't found because it doesn't exist, or because we just haven't waited long enough. Since it's so hard to know, we ask the algorithm to stop once its tried 10000000 harmonies, and assume that the solution doesn't exist, even though the optimal solution could be the 10000001st harmony tried.

# Conclusion

Hopefully this has been an exciting journey through the world of metaheuristic optimisation algorithms, and you learned a thing or two. I sure did. The takeaways are:

 + Metaheuristic optimisation algorithms are useful for finding the optimal solution to some function which describes its arguments' "quality" or "fitness".
 + Harmony search is a neat example of these algorithms which attempts to optimize a solution based on the principles of jazz musicians
 + HS and company are applicable to a very wide range of problems, including solving puzzles like sudoku.
 + Sudoku however isn't really a good testbed for these algorithms because its easy enough to write a solving algorithm, and you have to write most of that algorithm to apply HS to sudoku anyways.

Thanks for reading!

### References

 1. Geem, Z.W.: Harmony Search Algorithm for Solving Sudoku. Knowledge-Based Intelligent Information and Engineering Systems. <http://dx.doi.org/10.1007/978-3-540-74819-9_46>

### Thanks

  Thanks to [Mo](http://fustat.org/) and Tomas for helping edit. Thanks to Dr Geem for creating and publishing so much about the algorithm. Thanks to the authors of [Protovis](http://vis.stanford.edu/protovis/) and [Mathjax](http://www.mathjax.org/) for superb code which made the visualizations and formulas on this page look great.

<script type="text/x-mathjax-config">
  MathJax.Hub.Config({
    extensions: ["tex2jax.js"],
    jax: ["input/TeX", "output/HTML-CSS"],
    tex2jax: {
      inlineMath: [ ['$','$'], ["\\(","\\)"] ],
      displayMath: [ ['$$','$$'], ["\\[","\\]"] ],
      processEscapes: true
    },
    "HTML-CSS": {
      availableFonts: ["TeX"],
      webFont: "TeX",
      imageFont: null
    },
    TeX: {
      extensions: ["AMSmath.js","AMSsymbols.js","noErrors.js","noUndefined.js"]
    }
  });
</script>

<script type="text/javascript" src="http://cdn.mathjax.org/mathjax/1.1-latest/MathJax.js"></script>
{% javascript harmonics/sudoku %}
<link href='/stylesheets/harmonics.css' rel='stylesheet' type='text/css' />
