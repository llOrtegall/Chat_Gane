import { useContext, useEffect, useRef, useState } from 'react'
import { uniqBy } from 'lodash'
import { Logo } from './Logo'
import { UserContext } from '../UserContext'
import axios from 'axios'
import { Contact } from './Contact'

export function Chat () {
  const [ws, setWs] = useState(null)
  const [onlinePeople, setOnlinePeople] = useState({})
  const [offLinePeople, setOffLinePeople] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [newMessageText, setNewMessageText] = useState('')
  const [messages, setMessages] = useState([])
  const { user } = useContext(UserContext)
  const divUnderMessages = useRef()

  useEffect(() => {
    connectToWs()
  }, [])

  function connectToWs () {
    const ws = new WebSocket('ws://localhost:3030')
    setWs(ws)
    ws.addEventListener('message', handleMessage)
    ws.addEventListener('close', () => {
      setTimeout(() => {
        console.log('Disconected. Trying to reconnect...')
        connectToWs()
      }, 1000)
    })
  }

  function showOnLinePeople (peopleArray) {
    const people = {}
    peopleArray.forEach(({ userId, username }) => {
      people[userId] = username
    })
    setOnlinePeople(people)
  }

  function handleMessage (e) {
    const messageData = JSON.parse(e.data)
    if ('online' in messageData) {
      showOnLinePeople(messageData.online)
    } else if ('text' in messageData) {
      setMessages(prev => ([...prev, { ...messageData }]))
    }
  }

  function sendMessage (ev) {
    ev.preventDefault()
    ws.send(JSON.stringify({
      recipient: selectedContact,
      text: newMessageText
    }))
    setNewMessageText('')
    setMessages(prev => ([...prev, {
      text: newMessageText,
      sender: user.userId,
      recipient: selectedContact,
      _id: Date.now()
    }]))
  }

  useEffect(() => {
    const div = divUnderMessages.current
    if (!div) return
    div.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  useEffect(() => {
    axios.get('/people').then(
      res => {
        const offLinePeopleArr = res.data
          .filter(p => p._id !== user.userId)
          .filter(p => !Object.keys(onlinePeople).includes(p._id))
        const offLinePeople = {}
        offLinePeopleArr.forEach(p => {
          offLinePeople[p._id] = p
        })
        setOffLinePeople(offLinePeople)
      }
    )
  }, [onlinePeople])

  useEffect(() => {
    if (selectedContact) {
      axios.get('/messages/' + selectedContact).then(response => {
        setMessages(response.data)
      })
    }
  }, [selectedContact])

  const onlinePeopleExcluOurUser = { ...onlinePeople }
  delete onlinePeopleExcluOurUser[user.userId]

  const messagesWithOutDupes = uniqBy(messages, '_id')

  return (
    <section className="flex h-screen">
      <div className="bg-blue-100 w-1/3">
        <Logo />
        {Object.keys(onlinePeopleExcluOurUser).map(userId => (
          <Contact
            key={userId}
            id={userId}
            online={true}
            username={onlinePeopleExcluOurUser[userId]}
            onClick={() => setSelectedContact(userId)}
            selected={userId === selectedContact}
          />
        ))}
         {Object.keys(offLinePeople).map(userId => (
          <Contact
            key={userId}
            id={userId}
            online={false}
            username={offLinePeople[userId].username}
            onClick={() => setSelectedContact(userId)}
            selected={userId === selectedContact}
          />
         ))}
      </div>
      <div className="flex flex-col bg-blue-300 w-2/3 p-2">
        <div className="flex-grow">
          {!selectedContact && (
            <div className='flex h-full items-center justify-center'>
              <div className='text-gray-500'>&larr; Select a contact from the sidebar</div>
            </div>
          )}
          {!!selectedContact && (
              <div className='relative h-full top-0 right-0 left-0 bottom-2'>
                <div className='overflow-y-auto absolute inset-0'>{messagesWithOutDupes.map(message => (
                  <div key={message._id} className={(message.sender === user.userId ? 'text-right' : 'text-left')}>
                    <div className={' ' + (message.sender === user.userId ? 'bg-blue-500 text-white p-2 m-2 rounded-md inline-block text-left' : 'bg-white text-gray-500 p-2 m-2 rounded-md inline-block')}>
                      {message.text}
                    </div>
                  </div>
                ))}
                  <div className='h-12' ref={divUnderMessages}></div>
                </div>
              </div>
          )}
        </div>
        {!!selectedContact && (
          <form className="flex gap-2" onSubmit={sendMessage}>
            <input type="text" placeholder="Type Your Message"
              className="bg-white border p-2 flex-grow rounded-md" value={newMessageText}
              onChange={ev => setNewMessageText(ev.target.value)} />
            <button type='submit' className="bg-blue-500 p-2 text-white rounded-md">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
