---
title: 'Using Images with Tufte-Style Positioning'
pubDate: '2023-11-15'
description: 'How to use different image positioning techniques in your blog posts'
tags: ['design', 'tutorial', 'images']
---

# Using Images with Tufte-Style Positioning

One of the hallmarks of Edward Tufte's design philosophy is the thoughtful placement of visual elements in relation to text. Our blog now supports various Tufte-inspired image positioning options that allow for elegant text wrapping and visual hierarchy.

## Basic Image Positioning

The simplest way to add an image is to use the standard right or left alignment with text wrap:

<div class="figure figure-right">
  <img src="/blog-placeholder-3.jpg" alt="Sample image">
  <div class="figure-caption">A right-aligned image with text wrapping around it.</div>
</div>

When you position an image to the right using the `figure-right` class, the text flows naturally around it, creating a pleasant reading experience. This works particularly well for smaller supporting images that complement your main text rather than dominating it.

Similarly, you can align images to the left using the `figure-left` class, which creates a different rhythm in your layout. Left-aligned images can be effective for introducing new sections or concepts.

## Tufte-Style Margin Positioning

<div class="figure figure-margin">
  <img src="/blog-placeholder-1.jpg" alt="Sample image in margin">
  <div class="figure-caption">This image sits in the margin area, similar to Tufte's margin notes.</div>
</div>

The true Tufte-style approach places images in the margin, similar to sidenotes. This keeps the main text column clean and uninterrupted while still allowing visual elements to support and enhance the content.

When using margin positioning, consider using smaller, simpler images that don't require extensive detail to understand, as they'll be displayed at a reduced size.

## Center and Mid Positioning

For more impactful images, you can use center positioning or the mid-right/mid-left options.

<div class="figure figure-center">
  <img src="/blog-placeholder-4.jpg" alt="Center positioned image">
  <div class="figure-caption">A centered image that spans most of the content width.</div>
</div>

Centered images work well for more important visuals that deserve focus. They interrupt the text flow but create a natural pause for the reader to absorb the visual information.

<div class="figure figure-mid-left">
  <img src="/blog-placeholder-5.jpg" alt="Mid-left positioned image">
  <div class="figure-caption">This mid-left image extends slightly into the left margin.</div>
</div>

The mid-left and mid-right positions are unique to our system, offering a compromise between in-text and margin positioning. They allow for larger images than standard left/right alignment while still enabling text wrap.

## Full-Width Images

For truly impactful visuals, you can use full-width images:

<div class="figure figure-full">
  <img src="/blog-placeholder-2.jpg" alt="Full-width image">
  <div class="figure-caption">A full-width image creates maximum visual impact.</div>
</div>

Full-width images are best used sparingly, perhaps as a header image or to showcase especially important visual content.

## Adding Your Cat Image

To add the cat image you've shared:

1. First, upload the image to the `public` directory of your site
2. Then reference it in your markdown like this:

```html
<div class="figure figure-mid-right">
  <img src="/cat.jpeg" alt="A cat with glowing eyes">
  <div class="figure-caption">A curious cat with striking eyes perched on a mossy log at night.</div>
</div>
```

This will display the cat image in a mid-right position with text wrapping around it.

## Styling Options

You can also add subtle styling to your images:

<div class="figure figure-right figure-bordered">
  <img src="/blog-placeholder-3.jpg" alt="Bordered image">
  <div class="figure-caption">Adding the figure-bordered class creates a subtle border.</div>
</div>

Or add a light shadow effect:

<div class="figure figure-left figure-shadow">
  <img src="/blog-placeholder-1.jpg" alt="Shadow effect image">
  <div class="figure-caption">Adding the figure-shadow class creates a subtle shadow effect.</div>
</div>

## Responsive Behavior

All these positioning options are fully responsive. On smaller screens, margins adjust automatically, and on mobile devices, images become full-width to ensure legibility and proper display regardless of device. 