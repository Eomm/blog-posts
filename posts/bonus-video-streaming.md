# How to implement video streaming with Fastify
## Enabling a smooth playback that gives users an interactive video experience

In April 2021, [I tweeted](https://x.com/ManuEomm/status/1385694984880406528) about a quick experiment where I streamed a large GoPro video using Fastify.

That initial experiment sparked some interest, and just a few months ago, a user reached out with an intriguing question: how could they modify the code to support stream segmentation? Specifically, they wanted users to be able to jump to different parts of the video, effectively allowing timeline scrubbing during playback. I considered this a fascinating challenge and decided to turn it into a blog post.

In this article, we'll explore how to implement video streaming with Fastify, focusing on handling range requests. This will enable smooth playback even with large video files, allowing users to seek through the video timeline effortlessly.

By the end of this post, you'll understand the key concepts behind video streaming in Node.js, how to use Fastify to serve video content efficiently, and how to handle range requests to enhance the user experience with precise control over video playback.

## Setting up the project

Before we dive into the code, let's set up our project environment. We'll be using Node.js 20 and Fastify v4 for this tutorial. Additionally, you'll need a large video file to stream — I'll be using a GoPro video I filmed while riding a jet ski with my fiancée 😄

Here's how you can create and set up the project. I've also included some additional plugins we'll need to complete the exercise:

```bash
# Create a new directory for the project
mkdir fastify-video-streaming
cd fastify-video-streaming

# Initialize a new Node.js project with ES6 module support
npm init es6 --yes

# Install Fastify and necessary plugins
npm install fastify@4 fastify-range@1
```

With the project initialised and dependencies installed, we're ready to start building the video streaming server.

## Getting ready to stream

With our project set up, it's time to start coding. We'll begin by initialising the Fastify application and setting up a basic route to serve an HTML page containing a video tag. This HTML page will be the frontend interface for our video streaming where users can play and seek through the video content.

First, create a new file named `app.js` in your project directory. Now, let's write the code to initialise the Fastify server and set up the root route to serve the HTML page:

```js
import Fastify from 'fastify'
import * as fs from 'node:fs'

// Initialize the Fastify application with logging enabled
const app = Fastify({ logger: true })

// Set up a route to serve the HTML page
app.get('/', async () => {
  // Serve the index.html file from the project directory
  return fs.createReadStream('./index.html')
})

// Start the server and listen on port 8080
await app.listen({ port: 8080 })
```

Next, create an `index.html` file in the same directory to define the structure of our frontend and add the following **basic** code:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Video Streaming with Fastify</title>
</head>
<body>
    <h1>Fastify Video Streaming</h1>
    <video controls width="600">
        <source src="/video-streaming" type="video/mp4">
        Your browser does not support the video tag.
    </video>
</body>
</html>
```

This simple HTML page includes a video element that will request the video stream from our server via the `/video-streaming` route, which we'll implement next.

At this point, your Fastify server is set up to serve an HTML page that will act as the frontend for our video streaming application. 

By running the `node --watch app.js` command in your terminal, you can start the server and access the page at `http://localhost:8080` in your browser. You should see a basic page with a video player ready to stream content.

## Streaming video content

With the basic setup in place, it's time to implement the core functionality of our streaming server: handling video content with support for range requests.
This is what allows users to seek through the video timeline, providing a smooth and responsive playback experience.

### Understanding range requests

The `Range` HTTP header is essential for streaming large files like videos. It allows the client (in this case, the browser) to request specific portions of a file rather than downloading the entire file in one go. This functionality is particularly useful for video streaming, as it lets users jump to different parts of the video without having to load the entire file.

The range request feature is defined by [RFC 7233](https://datatracker.ietf.org/doc/html/rfc7233). When a browser sends a request for a video, it typically includes a `Range` header specifying the byte range it wants.

An example of a `Range` header might look like this:

```
Range: bytes=0-
```

The client is asking for the video file starting from byte 0 to the end. If the server supports range requests, it responds with a `206 Partial Content` status and includes the requested byte range in the `Content-Range` header.
Here's an example of the response headers:

```
Content-Range: bytes 0-1000000/2257069623
```

This header indicates that the server is sending bytes 0 to 1 MB of a total of 2.257.069.623 (>2GB!) bytes in the video file.

Now the browser knows how much of the video it has received, and it can request additional segments as needed without buffering the entire video. So, only when needed, the browser will request the next segment of the video such asking for bytes from 1MB:

```
Range: bytes=1000001-
```

Note that the `Range` header is typically used to request byte-ranges, but it can also be used to implement a pagination-like system where the range is a slice of a list of items—such as a range of users, because the specification allows custom units!
This was an [interesting topic on StackOverflow](https://stackoverflow.com/q/21765555/3309466), and I am mentioning it because it can be an interesting exercise for the mind to compare and contrast different ideas between developers!

**Errors:**
- "tipically" should be "typically."
- Added "also" after "can" for clarity.
- Rephrased "where the range is a slice of a list of items, for example, a range of users" to improve readability.
- "admits" should be "allows" for better word choice.
- "confront" should be "contrast" for clarity in the context of comparing ideas.

### Implementing the `/video-streaming` Route

Let’s add the `/video-streaming` route to our Fastify application to handle these range requests.

First, we must use the `fastify-range` plugin to easily parse the range header and extract the requested byte range. This plugin will add a request decorator to help us handle the range requests efficiently.

```js
import fastifyRange from 'fastify-range'

// ...
app.register(fastifyRange)
// ...
```

Now we can focus on the `/video-streaming` route implementation. Note that the route name was defined in the `src` attribute of the `<source>` tag in the `index.html` file.

```js
app.get('/video-streaming', async (request, reply) => {
  const videoPath = '/path/to/your/video.mp4'
  const videoSize = fs.statSync(videoPath).size

  // Extract the range from the request headers
  const range = request.range(videoSize)
  request.log.info({ range })
  if (!range) {
    // If no valid range is found, throw a 416 error
    // as indicated by the RFC 7233
    const error = new Error('Range Not Satisfiable')
    error.statusCode = 416
    throw error
  }

  // Handle only the first range requested
  const singleRange = range.ranges[0]

  // Define the size of the chunk to send
  const chunkSize = 1 * 1e6 // 1MB
  const { start } = singleRange
  const end = Math.min(start + chunkSize, videoSize)
  const contentLength = end - start + 1

  // Set the appropriate headers for range requests
  reply.headers({
    'Accept-Ranges': 'bytes',
    'Content-Range': `bytes ${start}-${end}/${videoSize}`,
    'Content-Length': contentLength
  })

  // Send a 206 Partial Content status code
  reply.code(206)
  reply.type('video/mp4')
  
  // Stream the requested chunk of the video file
  return fs.createReadStream(videoPath, { start, end })
})
```

The code above does the following:

1. **Extracting the range:** When the browser requests the video, it sends a `Range` header indicating the portion of the file it wants to download. We extract this range using the `request.range(videoSize)` method, which is provided by the `fastify-range` plugin. Note that we need to know the total size of the video file to validate the range because the browser might request a range that exceeds the file size.

2. **Validating the range:** If no valid range is provided or the range is unsatisfiable, the server responds with a `416 Range Not Satisfiable` error. This indicates that the server cannot fulfil the request as specified.

3. **Chunk size and byte ranges:** We calculate the size of the chunk to send based on the requested range. In this case, we’ve set the chunk size to 1MB and it is up to the server implementation to choose the appropriate size. You may implement a more complex logic to determine the chunk size based on the client's bandwidth or device. The `start` and `end` variables define the exact byte range that will be streamed back to the client.

4. **Setting headers:** The server responds with a `206 Partial Content` status and includes headers like `Content-Range` and `Content-Length` to inform the client of the specific byte range being sent.

5. **Streaming the video:** Finally, the server streams the requested portion of the video file using `fs.createReadStream(videoPath, { start, end })`. This allows the video player in the browser to play the video while additional portions are requested as needed.

With this implementation, our Fastify server is now capable of streaming video content efficiently, handling range requests to provide a seamless playback experience for users.

The HTML `<video>` tag in our `index.html` file automatically handles range requests when a user interacts with the video's timeline controls. For instance, if a user clicks ahead to a different part of the video, the browser sends a new request with an updated `Range` header, prompting the server to deliver the corresponding video segment.

This mechanism ensures smooth playback and efficient use of bandwidth, as only the necessary parts of the video are loaded and played.

By implementing this route, we’ve enabled our server to stream large video files efficiently, providing users with the ability to navigate through the video timeline seamlessly:

![Video example](./fastify-video-streaming.gif)

## Conclusion

In this tutorial, we explored how to build a video streaming server using Fastify and Node.js. We implemented a Fastify application capable of serving large video files with support for range requests. This approach allows users to interact with the video timeline, seamlessly streaming only the necessary parts of the video. The source code for this project is available on [GitHub](https://github.com/Eomm/blog-posts/tree/HEAD/bonus/video-streaming/).

I want to point out that this implementation is a basic example to get you started with video streaming in Fastify.
In a real-world scenario, we should consider additional features like caching, security, and performance optimisations to ensure a robust and reliable video streaming service, but now you have the tools to implement video streaming in your own projects, allowing users to enjoy a smooth and interactive video experience.

If you enjoyed this article, comment, share and follow me on [Twitter](https://twitter.com/ManuEomm)!
