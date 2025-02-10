require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const player = require('play-sound')();

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let userTasks = {};
let vacationMode = {};

const successSong = 'songs/aarambh.mp3';
const failSong = 'songs/motivation.mp3';

// ✅ Start Command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
👋 **Welcome to Your Personal Accountability Bot!**  

💡 **Mere Features:**  
✅ **Daily Task Reminders** – Aapko aapke tasks yaad dilata rahunga.  

✅ **Auto Task Reset** – Har raat 12 baje saare tasks "pending" ho jayenge.  

✅ **Music Motivation** – Task complete hone pe song bajega! 🎵  

✅ **Failure Alert** – Agar fail kiya to sad GIF + dard bhar song milega. 😢  

✅ **Full Timetable Support** – Ek baar me pura timetable set kar sakte ho.  

✅ **Vacation Mode** – Jab bahar ho, to reminders band karne ka option hai.  

✅ **Multi-User Support** – Aapke saare doston ke liye bhi available hai!  

⚡ **Commands:**  
📌 **/addtask [task]** – Naya task add kare individual. -->  Ex. /addtask <Task Name> <Timing>, /addtask Go for School 07:10 AM

📌 **/tasks** – Apne saare tasks dekho.  

📌 **/done [task number]** – Task complete mark kare. ✅  

📌 **/fail [task number]** – Task fail mark kare. ❌  

📌 **/deletetask [task number]** – Specific task delete kare.

📌 **/cleartasks** – Sare tasks clear kare.  

📌 **/timetable** – Pura timetable ek saath add kare. --->  Ex. /timetable Subha (Wake+Yoga+Fresh) 05:15 AM; Gym jana 06:00 AM; Bath 06:40 AM; and so on with comma separated.

📌 **/vacation [on/off]** – Vacation mode enable/disable kare.  

🚀 **Chalo ab productivity badhane ka time aa gaya!**  

Bolo, kya karna hai?  
  `;

    bot.sendMessage(chatId, welcomeMessage);
});

// ✅ **Poora Time Table Ek Saath Add Karna**
bot.onText(/\/timetable (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const timeTableData = match[1].split(';');

    if (!userTasks[chatId]) userTasks[chatId] = [];

    timeTableData.forEach((entry) => {
        const taskObj = parseTask(entry);
        if (taskObj) userTasks[chatId].push(taskObj);
    });

    bot.sendMessage(
        chatId,
        '✅ Aapka full time table set ho gaya! /tasks likh ker dekho.'
    );
});

// ✅ **Akele Task Add Karna (Bina Time Table Ke)**
bot.onText(/\/addtask (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!userTasks[chatId]) userTasks[chatId] = [];

    const taskObj = parseTask(match[1]);
    if (taskObj) {
        userTasks[chatId].push(taskObj);
        bot.sendMessage(
            chatId,
            `✅ Task added: "${taskObj.task}" at ${taskObj.time}`
        );
    } else {
        bot.sendMessage(
            chatId,
            '❌ Galat format! Format: `/addtask Subah uthna 05:30 AM`'
        );
    }
});

// ✅ **Show All Tasks**
bot.onText(/\/tasks/, (msg) => {
    const chatId = msg.chat.id;
    if (!userTasks[chatId] || userTasks[chatId].length === 0) {
        bot.sendMessage(chatId, '❌ Koi task set nahi hai.');
    } else {
        const taskList = userTasks[chatId]
            .map(
                (t, i) =>
                    `🔹 ${i + 1}. ${t.task} at ${t.time} - ${
                        t.completed ? '✅ Done' : '❌ Pending'
                    }`
            )
            .join('\n');
        bot.sendMessage(chatId, `📋 **Aapke Tasks:**\n${taskList}`, {
            parse_mode: 'Markdown',
        });
    }
});

// ✅ **Update Task**
bot.onText(/\/update (\d+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const taskIndex = parseInt(match[1]) - 1;
    const newTask = match[2];

    if (userTasks[chatId] && userTasks[chatId][taskIndex]) {
        userTasks[chatId][taskIndex].task = newTask;
        bot.sendMessage(chatId, `✅ Task updated! \n🔹 New Task: "${newTask}"`);
    } else {
        bot.sendMessage(
            chatId,
            '❌ Galat task number, /tasks likh ker check karo.'
        );
    }
});

// ✅ **Delete Task**
bot.onText(/\/delete (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const taskIndex = parseInt(match[1]) - 1;

    if (userTasks[chatId] && userTasks[chatId][taskIndex]) {
        const deletedTask = userTasks[chatId].splice(taskIndex, 1);
        bot.sendMessage(
            chatId,
            `🗑 Task deleted! \n🔹 Removed Task: "${deletedTask[0].task}"`
        );
    } else {
        bot.sendMessage(
            chatId,
            '❌ Galat task number, /tasks likh ke check karo.'
        );
    }
});

// ✅ Vacation Mode
bot.onText(/\/vacation (on|off)/, (msg, match) => {
    const chatId = msg.chat.id;
    vacationMode[chatId] = match[1] === 'on';
    bot.sendMessage(chatId, `🌴 Vacation Mode: ${match[1].toUpperCase()}`);
});

// ✅ **Task Reminder System**
setInterval(() => {
    const now = new Date();
    const currentTime = `${now.getHours()}:${now.getMinutes()}`;

    Object.keys(userTasks).forEach((chatId) => {
        if (vacationMode[chatId]) return;

        userTasks[chatId].forEach((task) => {
            if (task.time === currentTime && !task.completed) {
                bot.sendMessage(
                    chatId,
                    `⏰ Reminder: "${task.task}" Karna hai!`
                );
            }
        });
    });
}, 60000 * 30); // Check every half an hour

// ✅ **Mark Task as Complete**
bot.onText(/\/done (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const taskIndex = parseInt(match[1]) - 1;

    if (userTasks[chatId] && userTasks[chatId][taskIndex]) {
        userTasks[chatId][taskIndex].completed = true;
        bot.sendMessage(chatId, `✅ Task Completed! 🎉`);
        bot.sendAnimation(
            chatId,
            'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif'
        ); // Motivational GIF
        player.play(successSong);
    } else {
        bot.sendMessage(
            chatId,
            '❌ Galat task number, /tasks likh ke check karo.'
        );
    }
});

// ❌ Task Failed with GIF
bot.onText(/\/fail (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const taskIndex = parseInt(match[1]) - 1;

    if (userTasks[chatId] && userTasks[chatId][taskIndex]) {
        bot.sendMessage(chatId, `❌ Task Fail Hogaya! 😢`);
        bot.sendAnimation(
            chatId,
            'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif'
        ); // Sad GIF
        player.play(failSong);
    } else {
        bot.sendMessage(
            chatId,
            '❌ Galat task number, /tasks likh ke check karo.'
        );
    }
});

// ✅ **Parse Time Format**
function parseTask(input) {
    const parts = input.trim().match(/(.+) (\d{1,2}):(\d{2}) ?(AM|PM)?/i);
    if (parts) {
        let task = parts[1].trim();
        let hours = parseInt(parts[2]);
        let minutes = parseInt(parts[3]);
        let period = parts[4];

        if (period) {
            if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
            if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
        }

        return { task, time: `${hours}:${minutes}`, completed: false };
    }
    return null;
}

// resetting the task to start

const resetTasksDaily = () => {
    schedule.scheduleJob('0 0 * * *', () => {
        // Runs at 00:00 (midnight) every day
        Object.keys(userTasks).forEach((chatId) => {
            userTasks[chatId].forEach((task) => {
                task.completed = false; // Mark as pending
            });
        });
        console.log('✅ All tasks reset to pending at midnight.');
    });
};

// Call this function when starting the bot

resetTasksDaily();

console.log('🚀 Bot is running...');
