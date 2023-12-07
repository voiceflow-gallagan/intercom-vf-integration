require('dotenv').config()
const { htmlToText } = require('html-to-text')

// Intercom Client
const { Client } = require('intercom-client')
const Intercom = new Client({
  tokenAuth: {
    token: process.env.INTERCOM_TOKEN,
  },
})
Intercom.useRequestOpts({
  headers: {
    'Intercom-Version': 2.4,
  },
})

// Check Intercom API Setup
async function checkIntercom() {
  try {
    const counts = await Intercom.counts.countConversation()
    console.log('Intercom API OK')
  } catch (error) {
    console.log('Intercom API Error')
    console.log(error.body.errors)
    process.exit(1)
  }
}
checkIntercom()

let session = 0
let noreplyTimeout = null
let user_id = null
let user_name = null
let user_email = null
let convo_id = null

// Voiceflow DM API Config
const VF_ENDPOINT = process.env.VF_ENDPOINT || 'general-runtime.voiceflow.com'
const DMconfig = {
  tts: false,
  stripSSML: false,
  excludeTypes: ['block', 'debug', 'flow'],
}

const request = require('request'),
  express = require('express'),
  axios = require('axios').default,
  app = express().use(express.json())

app.listen(process.env.PORT, () => console.log('webhook is listening'))

app.get('/', (req, res) => {
  res.json({
    success: true,
    info: 'DM API | Intercom v1.0.0 | V⦿iceflow | 2022',
    status: 'healthy',
    error: null,
  })
})

app.get('/start', async (req, res) => {
  const response = await Intercom.conversations.create({
    userId: process.env.INTERCOM_USER_ID,
    body: 'Hi there!',
  })
  res.json({ message: 'ok' })
})

app.all('/webhook', async (req, res) => {
  /* You can debug Intercom events here
      console.log('Headers:' + JSON.stringify(req.headers, null, 3))
      console.log('Body:' + JSON.stringify(req.body, null, 3))
  */

  // Sendind 200 OK to Intercom Webhook
  res.json({ message: 'ok' })

  // Checking if the event is a conversation from user
  if (
    req.body?.data?.item?.type == 'conversation' &&
    req.body?.data?.item?.conversation_parts?.conversation_parts[0]?.author
      ?.type == 'user'
  ) {
    console.log('User message received:')
    let user_id =
      req.body?.data?.item?.conversation_parts?.conversation_parts[0]?.author
        ?.id
    let convo_id = req.body?.data?.item?.id
    let user_name =
      req.body?.data?.item?.conversation_parts?.conversation_parts[0]?.author
        ?.name
    let user_email =
      req.body?.data?.item?.conversation_parts?.conversation_parts[0]?.author
        ?.email
    let message = htmlToText(
      req.body?.data?.item?.conversation_parts?.conversation_parts[0]?.body
    )
    console.log('Message:', message)
    console.log('From:', user_name)
    console.log('Email:', user_email)

    await interact(
      user_id,
      {
        type: 'text',
        payload: message,
      },
      user_name,
      user_email,
      convo_id
    )
  }
})

async function reset() {
  await axios({
    method: 'GET',
    url: `https://${VF_ENDPOINT}/interact/state?logs=off`,
    headers: {
      Authorization: process.env.VF_DM_API,
      'Content-Type': 'application/json',
      sessionID: session,
      versionID: process.env.VF_PROJECT_VERSION,
    },
  })
}

async function interact(user_id, request, user_name, user_email, convo_id) {
  clearTimeout(noreplyTimeout)
  if (!session) {
    session = `${process.env.VF_PROJECT_VERSION}.${rndID()}`
  }
  // Update variables
  await axios({
    method: 'PATCH',
    url: `https://${VF_ENDPOINT}/state/user/${encodeURI(user_id)}/variables`,
    headers: {
      Authorization: process.env.VF_DM_API,
      'Content-Type': 'application/json',
    },
    data: {
      user_id: user_id,
      user_name: user_name,
      user_email: user_email,
    },
  })

  let response = await axios({
    method: 'POST',
    url: `https://${VF_ENDPOINT}/state/user/${encodeURI(
      user_id
    )}/interact?logs=off`,
    headers: {
      Authorization: process.env.VF_DM_API,
      'Content-Type': 'application/json',
      versionID: process.env.VF_PROJECT_VERSION,
      sessionID: session,
    },
    data: {
      action: request,
      config: DMconfig,
    },
  })

  let isEnding = response.data.filter(({ type }) => type === 'end')
  if (isEnding.length > 0) {
    console.log('isEnding')
    isEnding = true
  } else {
    isEnding = false
  }

  let messages = []
  /*
"body": "<p class=\"no-margin\">Hi <i>there</i></p>\n<h1 id=\"h_eb6912192f\">This is a test H1</h1>\n<h2 id=\"h_5ff6e5c157\">This is a test H2</h2>\n<p class=\"no-margin\"></p>\n<pre><code>this is some code</code></pre>",

"body": "<p class=\"no-margin\"><code>test</code></p>\n<p class=\"no-margin\"></p>\n<p class=\"no-margin\">and a <a href=\"https://www.voiceflow.com\" rel=\"nofollow noopener noreferrer\" target=\"_blank\" class=\"intercom-content-link\">link</a></p>"

*/
  for (let i = 0; i < response.data.length; i++) {
    if (response.data[i].type == 'text') {
      let tmpspeech = ''
      for (let j = 0; j < response.data[i].payload.slate.content.length; j++) {
        for (
          let k = 0;
          k < response.data[i].payload.slate.content[j].children.length;
          k++
        ) {
          if (response.data[i].payload.slate.content[j].children[k].type) {
            if (
              response.data[i].payload.slate.content[j].children[k].type ==
              'link'
            ) {
              tmpspeech += `<a href="${response.data[i].payload.slate.content[j].children[k].url}" rel="nofollow noopener noreferrer" target="_blank" class="intercom-content-link">${response.data[i].payload.slate.content[j].children[k].children[0].text}</a>`
            }
          } else if (
            response.data[i].payload.slate.content[j].children[k].text != '' &&
            response.data[i].payload.slate.content[j].children[k].fontWeight
          ) {
            tmpspeech +=
              '<b>' +
              response.data[i].payload.slate.content[j].children[k].text +
              '</b>'
          } else if (
            response.data[i].payload.slate.content[j].children[k].text != '' &&
            response.data[i].payload.slate.content[j].children[k].italic
          ) {
            tmpspeech +=
              '<i>' +
              response.data[i].payload.slate.content[j].children[k].text +
              '</i>'
          } else if (
            response.data[i].payload.slate.content[j].children[k].text != '' &&
            response.data[i].payload.slate.content[j].children[k].underline
          ) {
            // Underline is not supported by Intercom
            tmpspeech +=
              '<u>' +
              response.data[i].payload.slate.content[j].children[k].text +
              '</u>'
          } else if (
            response.data[i].payload.slate.content[j].children[k].text != '' &&
            response.data[i].payload.slate.content[j].children[k].strikeThrough
          ) {
            // Strike is not supported by Intercom
            tmpspeech +=
              '<del>' +
              response.data[i].payload.slate.content[j].children[k].text +
              '</del>'
          } else if (
            response.data[i].payload.slate.content[j].children[k].text != ''
          ) {
            tmpspeech +=
              response.data[i].payload.slate.content[j].children[k].text
          }
        }
        tmpspeech += '\n'
      }
      messages.push({
        type: 'text',
        value: tmpspeech,
      })
    } else if (response.data[i].type == 'speak') {
      if (response.data[i].payload.type != 'audio') {
        messages.push({
          type: 'text',
          value: response.data[i].payload.message,
        })
      }
    } else if (response.data[i].type == 'visual') {
      messages.push({
        type: 'image',
        value: response.data[i].payload.image,
      })
    } else if (response.data[i].type == 'Intercom Attachment') {
      messages.push({
        type: 'attachment',
        value: JSON.parse(response.data[i].payload).url,
        name: JSON.parse(response.data[i].payload).name,
      })
    } else if (response.data[i].type == 'no-reply' && isEnding == false) {
      noreplyTimeout = setTimeout(function () {
        console.log('Set timeout')
        sendNoReply(user_id, user_name, user_email, convo_id)
      }, Number(response.data[i].payload.timeout) * 1000)
    }
  }

  await sendMessage(messages, convo_id)
  if (isEnding == true) {
    // reset()
    saveTranscript(user_name)
  }
}

async function sendMessage(messages, convo_id) {
  for (let j = 0; j < messages.length; j++) {
    let data
    let attachment = []
    let ignore = null
    if (messages[j].type == 'image') {
      // Image
      data = `<div class="intercom-container"><img src="${messages[j].value}"></div>`
    } else if (messages[j].type == 'text') {
      // Text
      data = messages[j].value
    } else if (messages[j].type == 'attachment') {
      data = `${messages[j].name}`
      attachment.push(messages[j].value)
      console.log(attachment)
    } else {
      ignore = true
    }
    if (!ignore) {
      const sendIntercom = await Intercom.conversations.replyByIdAsAdmin({
        id: convo_id,
        adminId: process.env.INTERCOM_ADMIN_ID,
        messageType: 'comment', // note
        body: data,
        attachmentUrls: attachment,
      })
    }
  }
}

// Handle No-Reply
async function sendNoReply(user_id, user_name, user_email, convo_id) {
  console.log('No reply')
  await interact(
    user_id,
    {
      type: 'no-reply',
    },
    user_name,
    user_email,
    convo_id
  )
}

// Save transcript at the end of the convo
async function saveTranscript(user_name) {
  if (process.env.VF_PROJECT_VERSION != 'production') {
    console.log('SAVE TRANSCRIPT')
    axios({
      method: 'put',
      url: 'https://api.voiceflow.com/v2/transcripts',
      data: {
        browser: 'Chrome',
        device: 'WhatsApp',
        os: 'macOS',
        sessionID: session,
        versionID: process.env.VF_PROJECT_VERSION,
        unread: true,
        user: {
          name: user_name,
          image: 'https://chatwidget.voiceflow.fr/200x200.png',
        },
      },
      timeout: 120000,
      headers: {
        Cookie: `auth_vf=${process.env.VF_DM_API};`,
        'Content-Type': 'application/json',
      },
    })
      .then(function (response) {
        console.log('Transcript saved')
      })
      .catch((err) => console.log(err))
  }
  session = null
}

var rndID = function () {
  // Random Number Generator
  var randomNo = Math.floor(Math.random() * 1000 + 1)
  // get Timestamp
  var timestamp = Date.now()
  // get Day
  var date = new Date()
  var weekday = new Array(7)
  weekday[0] = 'Sunday'
  weekday[1] = 'Monday'
  weekday[2] = 'Tuesday'
  weekday[3] = 'Wednesday'
  weekday[4] = 'Thursday'
  weekday[5] = 'Friday'
  weekday[6] = 'Saturday'
  var day = weekday[date.getDay()]
  return randomNo + day + timestamp
}
