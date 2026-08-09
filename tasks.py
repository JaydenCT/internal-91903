tasks = []

def add_task():
    subject = input("Enter subject: ")
    work = input("Enter school work/task: ")
    time = input("Enter time: ")

    task = {
        "subject": subject,
        "work": work,
        "time": time
    }

    tasks.append(task)
    print("Task saved successfully!")

def view_tasks():
    print("\n--- School Planner Tasks ---")

    if len(tasks) == 0:
        print("No tasks saved yet.")
    else:
        for task in tasks:
            print(f"{task['time']} | {task['subject']} | {task['work']}")

def show_timetable():
    print("\n--- Updated Timetable ---")

    if len(tasks) == 0:
        print("No tasks in timetable.")
    else:
        for number, task in enumerate(tasks, start=1):
            print(f"{number}. {task}")

def add_task_simple():
    task = input("Enter a new task: ")
    tasks.append(task)
    show_timetable()

def edit_task():
    show_timetable()
    number = int(input("Enter task number to edit: "))
    new_task = input("Enter updated task: ")

    tasks[number - 1] = new_task
    show_timetable()

def delete_task():
    show_timetable()
    number = int(input("Enter task number to delete: "))

    tasks.pop(number - 1)
    show_timetable()

def main_menu():
    while True:
        print("\nSchool Planner")
        print("1. Add task")
        print("2. View tasks")
        print("3. Exit")

        choice = input("Choose an option: ")

        if choice == "1":
            add_task()
        elif choice == "2":
            view_tasks()
        elif choice == "3":
            print("Goodbye!")
            break
        else:
            print("Invalid option. Try again.")

if __name__ == '__main__':
    main_menu()
