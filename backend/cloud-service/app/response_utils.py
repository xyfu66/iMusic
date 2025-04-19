def success_response(data=None, message="Success", status_code=200):
    """
    返回成功的响应
    """
    return {
        "status_code": status_code,
        "success": True,
        "message": message,
        "data": data,
    }


def error_response(message="Error", status_code=400):
    """
    返回错误的响应
    """
    return {
        "status_code": status_code,
        "success": False,
        "message": message,
        "data": None,
    }