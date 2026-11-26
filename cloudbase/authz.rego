package authz.user

default allow := false

# 放通云函数网关调用。具体某个函数是否允许匿名/未登录调用，
# 由函数级安全规则（cloudbase/function-security-rule.json）和函数内部校验决定。
allow if {
  input.cloudbase.resource_type == "functions"
}
