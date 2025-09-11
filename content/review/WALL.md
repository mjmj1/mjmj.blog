---
tags:
  - review
---
# Git
https://github.com/SeonBab/GameMadang-2025-GameJam
# PlayerClimb.cs
``` c#
public class PlayerClimb : MonoBehaviour
    {
        [SerializeField] private LayerMask interact;
        [SerializeField] private Transform footPoint;
        [SerializeField] private float climbJumpForce = 5f;
        [SerializeField] private float climbSpeed = 10f;
        [SerializeField] private float climbObjectSnapSpeed = 30f;

        [SerializeField] private float entryMargin = 0.2f;
        [SerializeField] private float endMargin = 0.1f;
        [SerializeField] private float exitNudge = 0.05f;
        [SerializeField] private float endGraceTime = 0.15f;
        [SerializeField] private float edgeSafety = 0.05f;

        [SerializeField] private float ropeKickImpulse = 6f;
        [SerializeField] private float maxSwingXSpeed = 14f; // 속도 캡
        [SerializeField] private float maxSwingYSpeed = 18f;

        [SerializeField] private string ladderClimbState = "Climb";
        [SerializeField] private AnimationClip ladderClimbClip;
        [SerializeField] private string ropeClimbState = "Rope";
        [SerializeField] private AnimationClip ropeClimbClip;
        [SerializeField] private string ropeSwingState = "Swing";
        [SerializeField] private float frameStepInterval = 0.08f;
        
        // 생략

        private void FixedUpdate()
        {
            if (ropeJoint && ropeJoint.connectedBody)
            {
                RopeTick();
                return;
            }

            if (IsClimbing && currentClimbable is RopeInteractable rope
                           && Mathf.Abs(inputHandler.MoveInput.x) > 0.01f)
            {
                print("Attach to rope");

                AttachToRopeSegment(rope);
                return;
            }

            HandleClimbing();
        }

        private int CheckEntryKey()
        {
            if (!currentClimbable) return 0;

            var feetY = footPoint ? footPoint.position.y : col.bounds.min.y;
            var top = currentClimbable.GetTop;
            var bottom = currentClimbable.GetBottom;

            if (feetY >= top - entryMargin) return -1;
            if (feetY <= bottom + entryMargin) return 1;
            return 0;
        }

        private void JumpOnClimb(InputAction.CallbackContext ctx)
        {
            if (playerLife.IsDead) return;
            if (!IsClimbing) return;

            EndClimb();
            DetachFromRope();
            var x = inputHandler.MoveInput.x;
            var dir = (Vector2.up + Vector2.right * Mathf.Sign(x)).normalized;
            rb.AddForce(dir * climbJumpForce, ForceMode2D.Impulse);
        }

        private IEnumerator BeginClimbCo()
        {
            while (currentClimbable &&
                   Mathf.Abs(currentClimbable.transform.InverseTransformPoint(rb.position).x) >
                   0.1f)
            {
                var local = currentClimbable.transform.InverseTransformPoint(rb.position);
                local.x = Mathf.Lerp(local.x, 0f, climbObjectSnapSpeed * Time.fixedDeltaTime);
                var next = currentClimbable.transform.TransformPoint(local);
                rb.MovePosition(next);
                yield return new WaitForFixedUpdate();
            }
        }

        private void StartClimb(InputAction.CallbackContext ctx)
        {
            if (playerLife.IsDead) return;
            if (IsClimbing) return;
            if (!currentClimbable) return;

            var vY = ctx.ReadValue<Vector2>().y;

            entryKey = CheckEntryKey();

            if (entryKey == -1 && vY >= 0f) return;
            if (entryKey == 1 && vY <= 0f) return;

            rb.linearVelocity = Vector2.zero;
            rb.gravityScale = 0f;
            col.isTrigger = true;
            IsClimbing = true;

            var p = rb.position;
            p.y = Mathf.Clamp(
                p.y,
                currentClimbable.GetBottom + edgeSafety,
                currentClimbable.GetTop - edgeSafety
            );
            rb.position = p;

            endBlockUntil = Time.time + endGraceTime;
            endArmed = false;

            nextStepAt = Time.time;
            SelectClimbAnimSet(currentClimbable is RopeInteractable);

            StartCoroutine(BeginClimbCo());
        }

        internal void EndClimb()
        {
            rb.gravityScale = originalGravity;
            col.isTrigger = false;
            IsClimbing = false;

            transform.rotation = Quaternion.identity;

            currentClimbable = null;

            animator.speed = 1f;

            kickLatch = 0;
        }

        private void HandleClimbing()
        {
            if (!IsClimbing) return;
            if (!currentClimbable) return;

            var v = inputHandler.MoveInput.y;

            UpdateAnimation(v);

            Vector2 up = !currentClimbable ? transform.up : currentClimbable.transform.up;

            var targetDeg = Mathf.Atan2(up.y, up.x) * Mathf.Rad2Deg - 90f;
            var next = Mathf.LerpAngle(rb.rotation, targetDeg, Time.fixedDeltaTime * 100f);
            rb.MoveRotation(next);

            var pos = rb.position + up * (v * climbSpeed * Time.fixedDeltaTime);
            var local = currentClimbable.transform.InverseTransformPoint(pos);
            local.x = Mathf.Lerp(local.x, 0f, Time.fixedDeltaTime * climbObjectSnapSpeed);
            var finalPos = currentClimbable.transform.TransformPoint(local);
            rb.MovePosition(finalPos);

            var feetY = footPoint ? footPoint.position.y : col.bounds.min.y;
            var atTop = Mathf.Abs(feetY - currentClimbable.GetTop) <= endMargin;
            var atBottom = Mathf.Abs(feetY - currentClimbable.GetBottom) <= endMargin;

            if (Time.time >= endBlockUntil && !atTop && !atBottom)
                endArmed = true;

            if (!endArmed) return;

            if (atTop && v > 0.01f)
            {
                rb.position += up * exitNudge;
                EndClimb();
                return;
            }

            if (atBottom && v < -0.01f)
            {
                rb.position -= up * exitNudge;
                EndClimb();
            }
        }

        private void DetachFromRope()
        {
            if (!ropeJoint && !ropeJoint.connectedBody) return;

            ropeJoint.connectedBody = null;
            ropeSeg = null;
            IsClimbing = false;
            ropeJoint.enabled = false;
        }

        private void AttachToRopeSegment(RopeInteractable seg)
        {
            if (!seg) return;

            kickLatch = 0;

            currentClimbable = null;
            transform.rotation = Quaternion.identity;

            ropeSeg = seg;

            ropeJoint.enabled = true;
            ropeJoint.connectedBody = seg.GetComponent<Rigidbody2D>();
            ropeJoint.autoConfigureConnectedAnchor = false;
            ropeJoint.enableCollision = false;
            ropeJoint.useLimits = false;
            ropeJoint.anchor = Vector2.zero;
            ropeJoint.connectedAnchor = seg.transform.InverseTransformPoint(rb.position);

            IsClimbing = true;
            rb.gravityScale = originalGravity;
            col.isTrigger = false;

            if (animator && !string.IsNullOrEmpty(ropeSwingState))
            {
                animator.speed = 1f; // 루프 재생
                animator.Play(Animator.StringToHash(ropeSwingState), 0, 0f);
            }
        }

        private void RopeTick()
        {
            if (!ropeSeg || !ropeJoint || !ropeJoint.connectedBody) return;

            RopeKick();

            var v = rb.linearVelocity;
            if (Mathf.Abs(v.x) > maxSwingXSpeed) v.x = Mathf.Sign(v.x) * maxSwingXSpeed;
            if (Mathf.Abs(v.y) > maxSwingYSpeed) v.y = Mathf.Sign(v.y) * maxSwingYSpeed;
            rb.linearVelocity = v;
        }

        private void RopeKick()
        {
            var x = inputHandler.MoveInput.x;

            var sign = Mathf.Abs(x) > 0.01f ? (int)Mathf.Sign(x) : kickLatch;

            if (sign != 0 && sign != kickLatch)
            {
                var ropeBody = ropeJoint.connectedBody;

                Vector2 forceDir = ropeBody.transform.right.normalized * sign;
                Vector2 applyAt = rb.worldCenterOfMass;

                ropeBody.AddForceAtPosition(forceDir * ropeKickImpulse, applyAt, ForceMode2D.Impulse);

                kickLatch = sign;
            }
        }
    }
```
- 기획님이 원하는 조작감으로 수정할 수 있도록 인스펙터에 관련 변수들을 표시 -> 하지만 너무 많은 선택권을 줘서 오히려 혼란이 옴
- 림보같은 조작감을 만들기 위해 많은 수정을 거침
- 오르내리기와 스윙을 자유롭게 변환하도록 만들고 싶었지만 시간 부족으로 구현하지 못함
- 로프와 사다리 모두에게 적용될 수 있도록 코드를 통합, Climbable이란 태그가 달려있으면 무엇이든지 오를 수 있도록 구현함
- 사다리를 Ground와 겹쳐서 설치도 되고, 양 끝 부분부터 오르내릴 수 있고 중간에서도 시작할 수 있도록 Collider bound를 기준으로 오를 수 있는 곳인지 체크함 -> 더 좋은 아이디어가 있을 것 같지만 시간 부족으로 구현하지 못함
# Parkour.cs
``` c#
public class Parkour : MonoBehaviour
    {
        public Collider2D IsParkour()
        {
            var dir = Vector2.up + Vector2.right * (sr.flipX ? 1 : -1);
            var hit = Physics2D.Raycast(transform.position, dir.normalized, rayLength,
                parkourLayer);
            Debug.DrawRay(rb.position, dir.normalized * rayLength, Color.red);

            return hit.collider;
        }

        public void StartParkour(Collider2D wall)
        {
            if (busy) return;
            if (wall) StartCoroutine(ParkourCo(wall));
        }

        private IEnumerator ParkourCo(Collider2D wall)
        {
            busy = true;
            canJump = false;
            col.isTrigger = true;

            var savedG = rb.gravityScale;
            rb.gravityScale = 0f;
            rb.linearVelocity = Vector2.zero;

            var targetTopY = wall.bounds.max.y;

            animator.SetTrigger(IsParkour1);

            var sideDir = Mathf.Sign(wall.bounds.center.x - rb.position.x);
            if (sideDir == 0) sideDir = 1f;

            var startX = rb.position.x;
            var upDistance = Mathf.Max(0f, targetTopY - col.bounds.min.y);
            var targetX = startX + sideDir * stepForwardDist;

            var xPerY = upDistance > 0f ? stepForwardDist / upDistance : 0f;

            while (col.bounds.min.y < targetTopY - epsilon)
            {
                var needY = targetTopY - col.bounds.min.y;
                var stepY = Mathf.Min(needY, parkourSpeed * Time.fixedDeltaTime);

                var stepX = sideDir * xPerY * stepY;

                rb.MovePosition(new Vector2(rb.position.x + stepX, rb.position.y + stepY));
                yield return new WaitForFixedUpdate();
            }

            var finalCenterY = targetTopY + col.bounds.extents.y;
            rb.MovePosition(new Vector2(targetX, finalCenterY));

            rb.gravityScale = savedG;
            col.isTrigger = false;

            yield return new WaitForSeconds(busyTime);

            busy = false;

            yield return new WaitForSeconds(jumpCooldown);

            canJump = true;
        }

        public bool IsBusy => busy;
        public bool CanJump => canJump;
    }
```
- 파쿠르 가능한 벽이 있으면 파쿠르를 수행 -> 콜라이더를 판정
- 점프 시 raycast를 쏴서 가능한 벽인지 확인 -> 기획 상 자동으로 파쿠르가 시작되도록 구현
# Elevator.cs
``` c#
public class Elevator : MonoBehaviour
{
    [SerializeField] private Rigidbody2D place;
    [SerializeField] private Transform topStop;
    [SerializeField] private Transform bottomStop;

    [SerializeField] private float speed = 2f;
    [SerializeField] private float stopEpsilon = 0.01f;

    private Coroutine moveCo;

    public void OnSwitch()
    {
        GoUp();
    }

    public void OffSwitch()
    {
        GoDown();
    }

    public void GoUp()
    {
        StopNow();
        moveCo = StartCoroutine(MoveTo(topStop.position));
    }

    public void GoDown()
    {
        StopNow();
        moveCo = StartCoroutine(MoveTo(bottomStop.position));
    }

    public void StopNow()
    {
        if (moveCo != null) StopCoroutine(moveCo);
        moveCo = null;
        place.linearVelocity = Vector2.zero;
    }

    private IEnumerator MoveTo(Vector2 target)
    {
        yield return new WaitForSeconds(0.5f);

        while ((place.position - target).sqrMagnitude > stopEpsilon * stopEpsilon)
        {
            var next = Vector2.MoveTowards(place.position, target, speed * Time.fixedDeltaTime);
            place.MovePosition(next);
            yield return new WaitForFixedUpdate();
        }

        place.MovePosition(target);
        moveCo = null;
    }

    [ContextMenu("Go Up")]
    private void CtxGoUp() => GoUp();

    [ContextMenu("Go Down")]
    private void CtxGoDown() => GoDown();
}
```
- 간단하게 bottomStop 부터 TopStop 까지 place가 이동하도록 구현
- 각 Stop 위치를 조절해서 좌우로 이동하는 것도 가능함
- 단순 엘레베이터가 아닌 퍼즐 요소로도 사용할 수 있었음