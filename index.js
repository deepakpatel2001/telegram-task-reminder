require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const player = require('play-sound')();

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let userTasks = {};
let vacationMode = {};

// ✅ Start Command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
👋 Welcome to Your Productivity Bot!  

Boost efficiency with:  
✅ Task Reminders – Never forget your tasks.  
✅ Auto Reset – Tasks reset daily at midnight.  
✅ Music Motivation – Success = 🎵 Motivation.  
✅ Failure Alerts – Missed a task? Get a reminder & a nudge.  
✅ Timetable Support – Add tasks individually or all at once.  
✅ Vacation Mode – Pause reminders when needed.  
✅ Multi-User Support – Invite friends to stay productive together.  

⚡ Commands:  
📌 /addtask [task] [time] – Add a task. (e.g., /addtask Gym 06:00 AM)
📌 /tasks – View all tasks.
📌 /done [task no.] – Mark a task as completed.
📌 /fail [task no.] – Mark a task as failed.
📌 /deletetask [task no.] – Remove a specific task.
📌 /cleartasks – Delete all tasks.
📌 /timetable [tasks] – Add multiple tasks at once with semicolon (;) separated. (e.g., /timetable Yoga 05:30 AM; Gym 06:00 AM;)
📌 /vacation [on/off] – Enable or disable vacation mode (e.g. /vacation on) vice versa.

🚀 Stay organized, stay productive!  
Let’s get started! What’s your first task?  
    `;

    bot.sendMessage(chatId, welcomeMessage);
});


// ✅ **Poora Time Table Ek Saath Add Karna**
bot.onText(/\/timetable(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!match[1]) return sendUsageMessage('/timetable', chatId);

    const timeTableData = match[1].split(';');
    if (!userTasks[chatId]) userTasks[chatId] = [];

    timeTableData.forEach((entry) => {
        const taskObj = parseTask(entry);
        if (taskObj) userTasks[chatId].push(taskObj);
    });

    bot.sendMessage(
        chatId,
        '✅ Your full timetable has been set! Use /tasks to view.'
    );
});


function sendUsageMessage(command, chatId) {
    const usageMessages = {
        '/addtask': '⚠️ Please provide only task name and time as in example. Example: /addtask Gym (task) 06:00 AM (Time)',
        '/timetable': '⚠️ Please provide tasks with semicolon(;) separated: Example: /timetable Yoga 05:30 AM; Gym 06:00 AM',
        '/done': '⚠️ Please specify the task number. Example: /done 2',
        '/fail': '⚠️ Please specify the task number. Example: /fail 2',
        '/delete': '⚠️ Please specify the task number. Example: /delete 2'
    };
    
    if (usageMessages[command]) {
        bot.sendMessage(chatId, usageMessages[command]);
    }
}

// ✅ **Akele Task Add Karna (Bina Time Table Ke)**
bot.onText(/\/addtask(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!match[1]) return sendUsageMessage('/addtask', chatId);

    if (!userTasks[chatId]) userTasks[chatId] = [];

    const taskObj = parseTask(match[1]);
    if (taskObj) {
        userTasks[chatId].push(taskObj);
        bot.sendMessage(
            chatId,
            `✅ Task added: "${taskObj.task}" at ${taskObj.time}`
        );
    } else {
        sendUsageMessage('/addtask', chatId);
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
                    `⏰ Reminder: Regarding your "${task.task} task."`
                );
            }
        });
    });
}, 60000); // Check every 10 minutes

// ✅ **Mark Task as Complete**
const successSong =
    'https://res.cloudinary.com/dctqeqg3f/video/upload/v1739247002/aarambh_xetdwf.mp3';
const failSong =
    'https://res.cloudinary.com/dctqeqg3f/video/upload/v1739247008/motivation_q2q3hz.mp3';

bot.onText(/\/done(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;

    // If user only sent "/done" without task numbers
    if (!match[1]) {
        bot.sendMessage(
            chatId,
            '⚡ Please specify which tasks to mark as complete!\n\nExample:\n✅ `/done 2`\n✅ `/done 1 3 5`\n✅ `/done 1,2,3`'
        );
        return;
    }

    if (!userTasks[chatId] || userTasks[chatId].length === 0) {
        return bot.sendMessage(chatId, '⚠️ No tasks available.');
    }

    // Extract multiple task numbers from input (space or comma-separated)
    const taskNumbers = match[1]
        .split(/[\s,]+/)
        .map((num) => parseInt(num, 10))
        .filter((num) => !isNaN(num));

    if (taskNumbers.length === 0) {
        return bot.sendMessage(chatId, '⚠️ Please provide valid task numbers.');
    }

    let completedTasks = [];
    let updatedTasks = [];

    userTasks[chatId].forEach((task, index) => {
        if (taskNumbers.includes(index + 1)) {
            completedTasks.push(`✅ Task ${index + 1}: *${task.task}*`);
        } else {
            updatedTasks.push(task);
        }
    });

    if (completedTasks.length > 0) {
        bot.sendMessage(chatId, completedTasks.join('\n'), {
            parse_mode: 'Markdown',
        });        

        // 🎉 Send success GIF
        bot.sendAnimation(
            chatId,
            'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZWF4ZDZ6bDlyc241Ync5ejk3MTBtMGtpNDFtN21ndG5yejlsMjg4ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ktHuiYG7qYCOrJCqG0/giphy.gif'
        );

        // 🎵 Play success song
        bot.sendVoice(chatId, successSong, {
            caption: '🎵 Congratulations! Keep Going! 💪',
        });

        // Update the task list (remove completed tasks)
        userTasks[chatId] = updatedTasks;

        bot.sendMessage(chatId, 'check your pending works using /tasks');
    } else {
        bot.sendMessage(chatId, '❌ No valid task numbers found.');
    }
});

bot.onText(/\/fail(?:\s+(\d+))?/, (msg, match) => {
    const chatId = msg.chat.id;

    // If user only sent "/fail" without a number, show example
    if (!match[1]) {
        bot.sendMessage(
            chatId,
            '⚠ Please specify which task to mark as failed!\n\nExample:\n❌ `/fail 2` (to mark task 2 as failed)'
        );
        return;
    }

    const taskIndex = parseInt(match[1]) - 1;

    if (userTasks[chatId] && userTasks[chatId][taskIndex]) {
        bot.sendMessage(chatId, `❌ Task ${match[1]} marked as failed! 😢`);

        // Send Sad GIF
        bot.sendAnimation(
            chatId,
            'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXRvcXpzMjd2MjRrdDJxemI4eTB5dWR2OG13aDZza252dTdzcWVkZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/uILufuV7HsDXy1OYra/giphy.gif'
        );

        // 🎵 Play fail song
        bot.sendVoice(chatId, failSong, {
            caption: '🎵 Try Again! You Can Do It! 💪',
        });

        // Remove the task from the list (optional)
        userTasks[chatId].splice(taskIndex, 1);
    } else {
        bot.sendMessage(
            chatId,
            '❌ Invalid task number. Use `/tasks` to check your list.'
        );
    }
});



bot.onText(/\/cleartasks/, (msg) => {
    const chatId = msg.chat.id;

    // Assume tasks are stored in an array (or database)
    userTasks[chatId] = []; // Clear all tasks for the user

    bot.sendMessage(chatId, '🗑 All tasks have been cleared!');
});

// ✅ **Parse Time Format**
function parseTask(input) {
    const parts = input.trim().match(/(.+) (\d{1,2}):(\d{2}) ?(am|pm|AM|PM)?/i);
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
