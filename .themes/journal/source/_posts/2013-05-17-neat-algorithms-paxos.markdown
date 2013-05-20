---
layout: post
title: "Neat Algorithms - Paxos"
date: 2013-05-17 12:41
comments: true
featured_image: "/images/headers/fighting.jpg"
photo_credit: "Carter Brundage"
shortlink: "http://bitly.foo"
categories: ['misc']
---


This is an article on and demonstration of an extraordinarily neat algorithm called Paxos. Paxos is a strategy for teaching a whole bunch of decidedly unreliable processes to reliably decide on stuff. More formally: it allows a group of potentially faulty processors to deterministically and safely reach consensus if Paxos' conditions are met while ensuring processors remain consistent if consensus can't be reached.


<div id="main_demo"></div>

# I disagree

If you are, say, a piece of e-commerce software, and, say, you want a record of when your customers buy stuff, how might you ensure that how can you get a record of each transaction every single time one happens? You certainly can't just leave a record on one computer, since that computer's disk might die and leave you with none of your data. You could put it on two computers, but you'd have to make sure that you write the information to both computers, so that if one failed you'd have a backup copy on the other computer. Worse is that you'd have to make sure that your record got written to both computers before you move on, because if it didn't make it to both places you again risk loosing that data. If, say, your data set grew to be too large to fit on one computer, you could network some computers who would be responsible for each storing some overlapping subset of the data. Now that this is happened you have a problem: who do you send write commands to? You could designate one computer as the "master", but since its disks might die, communication links might fail, or power cord might get unplugged, it can't really be relied upon forever. Then you might think, well, I'll just detect that the master computer has failed, and designate another one as the master! And as simple as that you have stumbled upon two tough computer science problems: detecting failure, and reaching consensus. In this post we're going to talk about the second hard problem here: in the presence of real life computers, that is to say ones which can fail unpredictably, how can we make them behave such that when failures do occur, they continue to work and keep on truckin'? How can we get them to reach consensus on who the next master might be?

The consensus problem is one of the quintessential building blocks of distributed systems, and seems to be regarded as one of the tougher ones from both a conceptional and software engineering point of view. The aim is to define a rigorous process for submitting a value to a cluster of machines which even in the face of the expected failures like those mentioned above, or even unexpected ones like faulty software, or even malicious agents, will ensure the cluster will eventually agree on what the value is. The cluster can agree to not accept a new value when one is submitted, or it can take a significant amount of time to accept it, but the key is that by the end of the process, the cluster "agrees" on what the "true" value is. Here (and I think in most other places), we'll define the true value as what the majority of the cluster thinks the value is, and agreement as the condition that no matter who you ask, you get the same answer.

The reasons this problem is challenging mostly arise from the simple fact that processes are unreliable. Disks fail, cords get unplugged, engineers write bugs, and yet all the while us humans still need these processes to continue working. It wouldn't be too tough to write a goofy consensus algorithm I shall enjoy titling "lol dunno" which just rejects any new incoming values in the event of any of these failures. Due to these failures inevitability however, "lol dunno" despite being simple is relatively useless. The consensus problem holds us engineers to a higher standard of coming up with a way for a cluster of processes with some errors to remain resilient and still accept new values for data.

# To have an argument, you must take up the contrary position

Consensus problem solvers enjoy a number of horrid subproblems stemming from the fact that they must admit that there is such a thing as time. Many clients might try to propose a new value to the system around the same time, or messages between processes might arrive slowly, or even out of order. A correct implementation of a solution to the problem must guarantee that one and only one value is agreed upon as the true value by the system at one instant. This means it must be completely resilient to conflicting clients proposing conflicting values, and bake in some sort of prevention of different factions of the system trying to pick one of the clients as the correct one.

# Paxos: something we can agree on.

Paxos is an algorithm to solve the consensus problem. Honest to goodness real life implementations of it can be found at the heart of world class software like Apache Zookeeper, Google's magnificent Spanner, or Google's distributed locking service Chubby.

The algorithm satisfies the following conditions:

 - Only values which are sent to the system can become a new value for the system (duh?)
 - Values can only become the new value for the system if consensus can be reached

Lets get some definitions out of the way so that if you explore the literature on the topic you can know what people are talking about:

 - `process`: one of the computers in the system. Also known as a replica.
 - `client`: a computer not in the system who is asking the system what the value is or to take on a new value
 - `proposal`: the thing generated by a client asking the system to take on a new value. Note that proposals may succeed or fail
 - `acceptance`: the act of one of the processes in the system deciding to take on a new value, or "accept" it as true.

# The guts

Let's examine the basic flow declared by the Paxos algorithm to set a new value.

 - A client of the Paxos governed system asks that a new value be set.

<div id="client_demo"></div>

 - Any one of the processes can recieve this request from the client. The process that does proposes this new value to the system by sending a `prepare` message to all the other processes it knows of.

<div id="prepare_demo"></div>

This `prepare` message holds a sequence number inside it, declaring that the receiving process should prepare to accept a proposal with that sequence number. Each process which receives the `prepare` message can either reply with a `promise` message or nothing at all.

 - These receiving processes make the critical check in the system: that they've never seen a sequence number higher than the one held in the incoming `prepare` message. If they haven't, then they can be sure that this is the newest proposal, and promise that they'll accept it. If they have seen something higher, they know there is a newer proposal out on the loose, and can reply telling the out-of-date proposer that they are as such. 

<div id="promise_demo"></div>

Paxos solves the problem of consensus over time by taking hold of time itself. Every time a process submits a value the system they associate with it a strictly increasing sequence number and associate the `prepare` (and as we'll see later, `accept`) messages with it. Using this number, a process in the system can identify in what order the messages it received were created, and apply temporal precedence.

 - The proposing process waits for the other processes to promise to accept only its proposal or a higher numbered one. Upon receiving promises from a majority of processes, the proposing process issues an `accept` message decreeing that they now store the proposed value associated with the sequence number in the proposal.

<div id="accept_demo"></div>


<script src="/assets/paxos/paxos.js" type="text/javascript"></script>
<link href='/assets/paxos.css' rel='stylesheet' type='text/css' />


