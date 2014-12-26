---
layout: post
title: "Neat Algorithms - Paxos"
date: 2014-12-27 12:42
comments: true
featured_image: "/images/headers/paxos.jpg"
photo_credit: "<a href=\"http://analogromance.tumblr.com/\">Carter Brundage</a>"
categories: ['neat algos']
---

{% stylesheet paxos %}

This is an explanation and demonstration of an extraordinarily neat algorithm called Paxos. Paxos is a family of algorithms for teaching a whole bunch of decidedly unreliable processes to reliably decide on stuff. More formally: it allows a group of unreliable processors to deterministically and safely reach consensus if some certain conditions can be met, while ensuring the group remains consistent if the conditions can't be met.

The demo below demonstrates a live version of Paxos implemented in Javascript. A first client proposes a new value to the system which then gets pre-empted by a second client, who then ends up getting it's new value accepted by the end of the algorithm.

<div id="main_demo"></div>

# Paxos: something we can agree on.

Paxos is an algorithm to solve the [consensus problem](http://harry.me/blog/2013/07/07/id-like-to-have-an-argument-a-primer-on-consensus/). Honest-to-goodness real-life implementations of Paxos can be found at the heart of world class software like Cassandra, Google's magnificent Spanner database, and also their distributed locking service Chubby. A system governed by Paxos is usually talked about in terms of the value, or state, it tracks. The system is built to allow many processes to store and report this value even if some fail, which is handy for building highly available and strongly consistent systems. To restate, a majority of the members of the system must agree that a particular value is in fact "the one true" value to then report it as such. Conversely, it means that one rogue process which has an out of date idea of the world can't report something that isn't "the one true" thing.

Let's get some definitions out of the way for upcoming explanation:

 - A `process` is one of the computers in the system. Lots of people use the word replica or node for this as well.
 - A `client` is a computer who isn't a member of the system, but is asking the system what the value is, or asking the system to take on a new value.

Paxos is only a small piece of building a distributed database: it only implements the process to write exactly one new thing to the system. Processes governed by an instance of Paxos can either fail, and not learn anything, or by the end of it have a majority having learned the same value such that there is consensus. Paxos doesn't really tell us how to use this to build a database or anything like that, it is just the process which governs the individual communications between nodes as they execute one instance of deciding on one new value. So, for our purposes here, the thing we build with Paxos is a datumbase which can store exactly one value, and only once, such that you can't change it after you've set it the first time.

# The read guts

<div id="read_demo"></div>

To read a value from the basic Paxos system, a client asks all the processes in the system what they have stored for the current value, and then takes the value that the majority of the processes in the system hold. If there is no majority or if not enough clients respond, the read fails. To the left you can see a client asking the nodes what their value is, and them returning the value to the client. When the client gets a majority of responses agreeing on a value, it has successfully read it and keeps it handy.

<br class="break" />

This is weird compared to single node systems. To determine the state of the system, the client needs to observe it, and to do that, it needs to ask all the members, so that it can be sure the reported value is in fact held by a majority of nodes. If it just asked one node, it could be asking a process which is out of date, and get the "wrong" value. Processes can be out of date for all sorts of reasons: messages to them might have been dropped by unreliable networks, they might have failed and recovered with an out of date state, or the algorithm could still be underway and the process could have just not gotten it's messages quite yet. It is important to note that this is "naïve" Paxos: there are much better ways of doing reads when implementing a system using Paxos that don't require contacting every node for every read, but they extend beyond the original Paxos algorithm.

# The write guts

Let's examine what Paxos makes our cluster of processes do when a client asks that a new value be written. The following procedure is all to get only one value written. Eventually we can use this process as a primitive to allow many values to be set one after another, but the basic Paxos algorithm governs the flow for the writing of just one new value, which is then repeated to make the thing actually useful.

<div id="client_demo"></div>

The process starts with a client of the Paxos governed system asks that a new value be set. The client here shows up as the pink circle, and the processes show up as the teal circles. Paxos makes a guarantee that the client can send their write request to any member of the Paxos cluster, so for the demos here the client picks one of the processes at random. This property is important and neat: it means that in the distributed consensus problem solution, there is no single point of failure, which means our Paxos governed system can continue to be online (and useful) when a node goes down for whatever unfortunate yet unavoidable reason. If we designated one particular node as "the proposer", or "the master" or what have you, then the whole system would grind to a halt if that node failed.

The Paxos process that receives the write request "proposes" this new value to the system. "Proposition" is in fact a formalized idea in Paxos: proposals to a system governed by Paxos can succeed or fail, and are a required step to ensure consensus is maintained. This proposal by the write-request-receiving client is sent to the whole system by way of a `prepare` message to all the other processes it knows of.

### Sequence Numbers

This `prepare` message holds what's called a _sequence number_ inside it. The sequence number is generated by the proposing process, and it declares that the receiving process should prepare to accept a proposal with that sequence number. This sequence number is key: it allows processes to differentiate between newer and older proposals. If two processes are trying to get a value set, Paxos says that value proposed last should take precedence, so this lets processes figure out which one is last, and thus who is trying to set the most recent value.

<div id="prepare_demo"></div>

These receiving processes are able to make a critical check in the system: is the sequence number on an incoming `prepare` message the highest I've ever seen? If it is, then cool, I can prepare to accept this incoming value, and disregard any others I have heard of before. You can see this happening to in the demo on the right: the client proposes a new value every so often to one process, that process sends `prepare` messages to the other replicas, and then those replicas note that these successively higher sequence numbers trump the older ones, and let go of those old proposals.

This little ordering idea is what lets any member of the system issue proposal to avoid the single point of failure associated with a designated "proposer" node mentioned above. Without this ordering, members of the Paxos system would have no way to figure out which proposal is the one they should prepare to accept with confidence.

We could imagine a different consensus algorithm which didn't do this step of sending a first message to ask the other processes to make sure the value trying to be set is the most recent one. Although being way simpler, this would no longer satisfy the consensus algorithm safety requirements. If two processes started proposing different values right around the same time (like in the demos below), the universe could conspire against us and align the packets such that each dueling proposer convinces one half the processes to accept their own maybe-right-maybe-wrong value. The system could end up in a stalemate! There would exist two evenly sized groups having staged different value, which would lead to no value being accepted by a majority group. This stalemate is avoided by the first Paxos message exchange with sequence numbers that allow the processes to all resolve which proposal they should accept. With Paxos' sequence numbers, one of the dueling proposals would have a lower number than the other, and thus upon proposal receipt processes will have a way to unambiguously pick the most recent one. They'd either get the higher number one first, and later receive the lower number one and reject it, or they'd get higher numbered one second and thus replace the lower numbered one with it. Paxos solves the problem of consensus over time by taking hold of time itself with sequence numbers to apply temporal precedence.

<div id="prepare_wrong_demo">
  <div class="viz"></div>
  <i>The above demo uses replicas which just accept the most recent message as the "truth", instead of using sequence numbers. Because the clients send at the same time, we end up with a split brain where some replicas get one message last, and others get a different one. Consensus can't be reached!</i>
</div>

<div id="prepare_right_demo">
  <div class="viz"></div>
  <i>The above demo uses proper Paxos replicas which examine the sequence number of the incoming proposal to figure out weather or not to actually prepare to accept the new value in tow. All the replicas disambiguate properly, and consensus could be reached!</i>
</div>

<br class="break" />

Side note: it's important that no two proposers ever use the same sequence number, and that they are sortable, so that they truly reference only one proposal, and precedence between proposals can be decided using a simple comparison. When implementing Paxos, these globally unique and sortable sequence numbers are usually derivatives of precise system time and node number in the cluster so they grow over time and are never the same.

### Promises

<div id="promise_demo"></div>

So, after the proposing process has sent out it's proposal, the replicas check it's sequence number against the highest they've ever seen, and if it is the highest, they can make a promise to not accept any proposals older than this new threshold sequence number. This promise is actually a message that gets sent from the other replicas to the one that is proposing a new value. This gives the proposing process the information it needs to count how many replicas have sent their promises, and thus the basis to establish if it has reached a majority or not. If a majority of processes have agreed to only accept this proposal or a higher one, the proposing process can know for certain it "has the floor", so to speak. There can only be one majority, so if a proposing process finds it has one, it knows it can maintain the safety property, and that consensus can be reached.

### Acceptance

<div id="accept_demo"></div>

With this knowledge that this majority holding proposing process is in fact the only one that could possibly be in that state, it can safely ask its promising processes to go ahead and accept the value that it has proposed. In other words, progress is made, and the goal of the algorithm is accomplished. This takes the form of an `accept` message decreeing that the promisers should now actually store the proposed value, and this Paxos execution is now complete.

All this procedure accomplishes one thing: durable writes. If some of the nodes which promised to accept a proposal fail, or if some nodes send back the promise, but then fail before they receive an accept message, that's completely ok! The proposing process only requires that a majority of nodes reply with a promise to accept, not every node, which is different than say two phase commit, or 2PC.

### Failure

 - failure during proposal
 - failure during accept
 - failure during read

If I got any of this stuff wrong, please send [me](mailto:harry@harry.me) an email and I will try to get it right!

{% javascript paxos/paxos %}
