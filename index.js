require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const player = require('play-sound')();
const moment = require('moment-timezone');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let userTasks = {};
let vacationMode = {};
let taskHistory = {}; // Store completed/uncompleted tasks before reset
let completedTasks = {}; // Store completed tasks
let failedTasks = {}; // Store failed tasks

resetTasksDaily();

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
📌 Note : You can make any type of operation here like update, delete, delete all, with available commands in menu button.


🚀 Stay organized, stay productive!  
Let’s get started! What’s your first task?  
    `;

    bot.sendMessage(chatId, welcomeMessage);
});

function checkTasksExist(chatId) {
    if (!userTasks[chatId] || userTasks[chatId].length === 0) {
        bot.sendMessage(
            chatId,
            '⚠️ No tasks available. Please create tasks first.'
        );
        return false;
    }
    return true;
}


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
bot.onText(/\/update(?:\s+(\d+)\s+(.+?)\s+(\d{1,2}:\d{2}))?/, (msg, match) => {
    const chatId = msg.chat.id;

    if (!checkTasksExist(chatId)) return;

    // If the task number and new task description are not provided, send a guide
    if (!match[1] || !match[2]) {
        return bot.sendMessage(
            chatId,
            '⚠️ Please specify the task number, new task description, and optionally the time.\n\nExample:\n🔹 `/update 2 Gym 14:30` (Update task number 2 with new description "Gym" and time "14:30")'
        );
    }

    const taskIndex = parseInt(match[1]) - 1;
    const newTask = match[2];
    const newTime = match[3];

    // Check if the task exists
    if (userTasks[chatId] && userTasks[chatId][taskIndex]) {
        userTasks[chatId][taskIndex].task = newTask;
        if (newTime) {
            userTasks[chatId][taskIndex].time = newTime;
        }

        let responseMessage = `✅ Task updated!\n🔹 New Task: "${newTask}"`;
        
        if (newTime) {
            responseMessage += `\n🕒 New Time: "${newTime}"`;
        }

        bot.sendMessage(chatId, responseMessage);
    } else {
        bot.sendMessage(
            chatId,
            '❌ Invalid task number, use `/tasks` to check your tasks.'
        );
    }
});



// ✅ **Delete Task**
bot.onText(/\/deletetask(?:\s+(\d+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!checkTasksExist(chatId)) return;
    if (!match[1]) {
        return bot.sendMessage(
            chatId,
            '⚠️ Please specify the task number to delete.\n\nExample:\n🔹 `/deletetask 2` (Delete task number 2)'
        );
    }

    const taskIndex = parseInt(match[1]) - 1;

    if (userTasks[chatId] && userTasks[chatId][taskIndex]) {
        const deletedTask = userTasks[chatId].splice(taskIndex, 1);
        bot.sendMessage(
            chatId,
            `🗑 Task deleted!\n🔹 Removed Task: "${deletedTask[0].task}"`
        );
    } else {
        bot.sendMessage(
            chatId,
            '❌ Invalid task number, use `/tasks` to check your tasks.'
        );
    }
});


// ✅ Vacation Mode
bot.onText(/\/vacation(?:\s+(on|off))?/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!match[1]) {
        return bot.sendMessage(
            chatId,
            '⚠️ Please specify on/off for vacation mode.\n\nExample:\n🔹 /vacation on\n🔹 /vacation off'
        );
    }

    vacationMode[chatId] = match[1] === 'on';
    bot.sendMessage(chatId, `🌴 Vacation Mode: ${match[1].toUpperCase()}`);
});

// ✅ **Task Reminder System**
setInterval(() => {
    const now = moment().tz("Asia/Kolkata");  // Set your desired time zone
    const currentTime = now.format("HH:mm");

    Object.keys(userTasks).forEach((chatId) => {
        if (vacationMode[chatId]) return;

        userTasks[chatId].forEach((task) => {
            if (task.time === currentTime && !task.completed) {
                bot.sendMessage(
                    chatId,
                    `⏰ Reminder: Regarding your "${task.task}" task.`
                );
            }
        });
    });
}, 60000); // Check every minute

// ✅ **Mark Task as Complete**
const successSong =
    'https://res.cloudinary.com/dctqeqg3f/video/upload/v1739247002/aarambh_xetdwf.mp3';
const failSong =
    'https://res.cloudinary.com/dctqeqg3f/video/upload/v1739247008/motivation_q2q3hz.mp3';

bot.onText(/\/done(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!checkTasksExist(chatId)) return;
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

    const taskNumbers = match[1]
        .split(/[\s,]+/)
        .map((num) => parseInt(num, 10))
        .filter((num) => !isNaN(num));

    if (taskNumbers.length === 0) {
        return bot.sendMessage(chatId, '⚠️ Please provide valid task numbers.');
    }

    let completedTasksMessage = [];
    let updatedTasks = [];

    userTasks[chatId].forEach((task, index) => {
        if (taskNumbers.includes(index + 1)) {
            completedTasksMessage.push(`✅ Task ${index + 1}: *${task.task}*`);
            // Add to completed tasks history
            if (!completedTasks[chatId]) completedTasks[chatId] = [];
            completedTasks[chatId].push(task);
        } else {
            updatedTasks.push(task);
        }
    });

    if (completedTasksMessage.length > 0) {
        bot.sendMessage(chatId, completedTasksMessage.join('\n'), {
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
    if (!checkTasksExist(chatId)) return;
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

        // Add to failed tasks history
        if (!failedTasks[chatId]) failedTasks[chatId] = [];
        failedTasks[chatId].push(userTasks[chatId][taskIndex]);

        // Remove the task from the list (optional)
        userTasks[chatId].splice(taskIndex, 1);
    } else {
        bot.sendMessage(
            chatId,
            '❌ Invalid task number. Use `/tasks` to check your list.'
        );
    }
});

// All completed task list
bot.onText(/\/completedtask/, (msg) => {
    const chatId = msg.chat.id;
    if (!checkTasksExist(chatId)) return;

    if (!completedTasks[chatId] || completedTasks[chatId].length === 0) {
        bot.sendMessage(
            chatId,
            '⚠️ You have not completed any tasks yet, or this is your first task. Start your tasks for the day!'
        );
    } else {
        const completedTaskList = completedTasks[chatId]
            .map((t, i) => `🔹 ${i + 1}. ${t.task} at ${t.time}`)
            .join('\n');
        bot.sendMessage(
            chatId,
            `📋 **Completed Tasks:**\n${completedTaskList}`,
            { parse_mode: 'Markdown' }
        );
    }
});

// all failed task
bot.onText(/\/incompletedtask/, (msg) => {
    const chatId = msg.chat.id;
    if (!checkTasksExist(chatId)) return;
    if (!failedTasks[chatId] || failedTasks[chatId].length === 0) {
        bot.sendMessage(
            chatId,
            '⚠️ You have not failed any tasks yet. Keep it up!'
        );
    } else {
        const failedTaskList = failedTasks[chatId]
            .map((t, i) => `🔹 ${i + 1}. ${t.task} at ${t.time}`)
            .join('\n');
        bot.sendMessage(chatId, `📋 **Failed Tasks:**\n${failedTaskList}`, {
            parse_mode: 'Markdown',
        });
    }
});

bot.onText(/\/cleartasks/, (msg) => {
    const chatId = msg.chat.id;
    if (!checkTasksExist(chatId)) return;
    bot.sendMessage(
        chatId,
        'Are you sure you want to clear all tasks? Type "yes" to confirm.',
        {
            reply_markup: {
                force_reply: true,
            },
        }
    ).then((sentMsg) => {
        bot.onReplyToMessage(chatId, sentMsg.message_id, (replyMsg) => {
            if (replyMsg.text.toLowerCase() === 'yes') {
                userTasks[chatId] = [];
                completedTasks[chatId] = [];
                failedTasks[chatId] = [];
                bot.sendMessage(
                    chatId,
                    '🗑 All tasks have been cleared! You can now create a new timetable or tasks.'
                );
            } else {
                bot.sendMessage(chatId, 'Task clearing cancelled.');
            }
        });
    });
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
        Object.keys(userTasks).forEach((chatId) => {
            if (!taskHistory[chatId]) taskHistory[chatId] = [];
            if (!completedTasks[chatId]) completedTasks[chatId] = [];
            if (!failedTasks[chatId]) failedTasks[chatId] = [];

            taskHistory[chatId].push(...userTasks[chatId]);
            completedTasks[chatId].push(...completedTasks[chatId]);
            failedTasks[chatId].push(...failedTasks[chatId]);

            userTasks[chatId] = [];
        });

        console.log('✅ All tasks moved to history and reset at midnight.');
    });
};

console.log('🚀 Bot is running...');
