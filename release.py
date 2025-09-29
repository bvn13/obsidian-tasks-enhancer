#!/usr/bin/env python3

import subprocess
import sys
import json
import argparse


def run_command(cmd, capture_output=True):
    """Выполняет команду и возвращает результат"""
    try:
        if capture_output:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
            return result.stdout.strip()
        else:
            subprocess.run(cmd, shell=True, check=True)
            return None
    except subprocess.CalledProcessError as e:
        print(f"Ошибка выполнения команды: {cmd}")
        print(f"Сообщение об ошибке: {e}")
        sys.exit(1)


def parse_arguments():
    """Парсит аргументы командной строки"""
    parser = argparse.ArgumentParser(description='Git commit and version management script')
    parser.add_argument('-p', '--patch', action='store_true', 
                       help='Use npm version patch')
    parser.add_argument('-m', '--minor', action='store_true', 
                       help='Use npm version minor (default)')
    return parser.parse_args()


def get_current_version() -> str:
    # Получаем версию из manifest.json
    try:
        with open('manifest.json', 'r') as f:
            manifest = json.load(f)
        version = manifest.get('version')
        if not version:
            print("Unable to find version information in manifest.json")
            sys.exit(1)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Unable to read manifest.json: {e}")
        sys.exit(1)
    return version


def commit_changes():
    # Проверяем статус git
    git_status = run_command("git status -s")
    print(f"******************\n{git_status}\n******************\n")
    
    if git_status:
        # Есть изменения для коммита
        try:
            commit_message = input("Enter commit message (Ctrl+C to abort): ")
        except KeyboardInterrupt:
            print("\nAborted")
            sys.exit(0)
        
        run_command("git add -A", capture_output=False)
        run_command(f'git commit -m "{commit_message}"', capture_output=False)
    else:
        print("Nothing to commit")


def parse_version(version_str):
    """Парсит версию в список чисел для сравнения"""
    return [int(part) for part in version_str.split('.')]


def add_new_version_to_versions_json(new_key):
    """
    Читает JSON файл, находит самый старший ключ, берет его значение,
    и добавляет новую запись с указанным ключом и этим значением.
    
    Args:
        filename (str): путь к JSON файлу
        new_key (str): новый ключ для добавления
    """
    # Чтение данных из файла
    filename = 'versions.json'
    try:
        with open(filename, 'r', encoding='utf-8') as file:
            data = json.load(file)
    except FileNotFoundError:
        print(f"Файл {filename} не найден")
        return
    except json.JSONDecodeError:
        print(f"Ошибка при чтении JSON из файла {filename}")
        return
    
    if not data:
        print("Файл пуст")
        return
    
    # Находим самый старший ключ (максимальную версию)
    try:
        latest_key = max(data.keys(), key=parse_version)
        latest_value = data[latest_key]
    except Exception as e:
        print(f"Ошибка при обработке версий: {e}")
        return
    
    # Добавляем новую запись
    data[new_key] = latest_value
    
    # Сохраняем обратно в файл
    try:
        with open(filename, 'w', encoding='utf-8') as file:
            json.dump(data, file, indent='\t', ensure_ascii=False)
        print(f"Добавлена новая запись: {new_key}: {latest_value}")
    except Exception as e:
        print(f"Ошибка при сохранении файла: {e}")


def main():
    args = parse_arguments()
    
    # Определяем тип версии
    if args.minor:
        version_type = "minor"
        version_command = "npm version minor"
    else:
        # По умолчанию используем patch
        version_type = "patch"
        version_command = "npm version patch"
    
    print("************************************************************")
    commit_changes()
    
    print("************************************************************")
    run_command(version_command, capture_output=False)
    print(f"Using version type: {version_type}")
    
    version = get_current_version()
    add_new_version_to_versions_json(version)
    print("************************************************************")
    res = run_command('git add versions.json', capture_output=True)
    print(res)
    print("************************************************************")
    res = run_command(f'git commit -m "v{version}"', capture_output=True)
    print(res)
    
    print("************************************************************")
    print("Checking tags")
    tags = run_command(f'git tag', capture_output=True)
    print(tags)
    print("************************************************************")
    status = run_command('git status', capture_output=True)
    print(status)
    print("************************************************************")
    print("Pushing tag to origin")
    res = run_command(f'git push origin {version}', capture_output=True)
    print(res)

if __name__ == "__main__":
    main()